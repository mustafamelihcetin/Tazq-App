using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Moq;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    public class TaskServiceTests
    {
        private readonly AppDbContext _context;
        private readonly Mock<ICryptoService> _cryptoMock;
        private readonly TaskService _taskService;
        private readonly byte[] _mockKey = new byte[32];

        public TaskServiceTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new AppDbContext(options);

            _cryptoMock = new Mock<ICryptoService>();
            
            /*
              SAHTE ŞİFRELEME GERÇEK BİÇİME SADIK OLMALI.

              Eskiden sahte çıktı yalnızca base64("enc_" + değer) idi ve çok kısaydı:
              "Task 1" için 16 karakter. Gerçek AES-GCM çıktısı ise HER ZAMAN
              IV(12) + veri + TAG(16) taşır, yani boş metin bile 40 karakterlik base64
              üretir. Sahte, gerçeğin üretemeyeceği bir şey üretiyordu.

              Bu önemsiz bir ayrıntı değildi: düz metin ile şifreli metni ayırt eden
              kontrol tam olarak bu uzunluğa dayanıyor (bkz. TaskService.SafeDecrypt —
              kısa, base64'e benzeyen düz metin başlıklar şifreli sanılıp "okunamıyor"
              yer tutucusuna dönüyordu). Gerçekçi olmayan sahte, o kontrolü test edilemez
              kılıyordu.

              Çözüm: sahte de 28 baytlık başlık taşısın — gerçek IV+TAG yükünün aynısı.
            */
            const int FakeOverhead = 28; // IV(12) + TAG(16), gerçek biçimle aynı

            _cryptoMock.Setup(c => c.Encrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
                .Returns((string val, byte[] k) =>
                {
                    var body = System.Text.Encoding.UTF8.GetBytes("enc_" + (val ?? string.Empty));
                    var buf = new byte[FakeOverhead + body.Length];
                    Buffer.BlockCopy(body, 0, buf, FakeOverhead, body.Length);
                    return Convert.ToBase64String(buf);
                });

            // Eski sır listesi: stub'lanmazsa null döner ve SafeDecrypt'in eski-anahtar
            // döngüsü NullReference atardı — yani sahte, gerçekte olmayan bir çökme üretir.
            _cryptoMock.Setup(c => c.GetLegacyKeysForUser(It.IsAny<int>()))
                .Returns(Array.Empty<byte[]>());

            _cryptoMock.Setup(c => c.Decrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
                .Returns((string val, byte[] k) => {
                    if (string.IsNullOrEmpty(val)) return string.Empty;
                    try
                    {
                        var raw = Convert.FromBase64String(val);
                        if (raw.Length < FakeOverhead) throw new FormatException("çok kısa — şifreli olamaz");
                        var decoded = System.Text.Encoding.UTF8.GetString(raw, FakeOverhead, raw.Length - FakeOverhead);
                        /*
                          YANLIŞ VERİDE İSTİSNA — gerçek AES-GCM'in davranışı.

                          Sahte önceden her durumda bir dize döndürüyordu; çözülemeyen veri
                          diye bir şey yoktu, dolayısıyla "okunamayan kayıt" yolu test
                          edilemiyordu. Gerçekte AES-GCM'in doğrulama etiketi tutmazsa
                          çözme EXCEPTION atar — kodun "eski anahtarları denemek güvenli"
                          varsayımı tam olarak buna dayanıyor.
                        */
                        if (!decoded.StartsWith("enc_")) throw new System.Security.Cryptography.CryptographicException("etiket tutmadı");
                        return decoded.Substring(4);
                    }
                    catch (FormatException)
                    {
                        // Base64 bile değil → düz metin kabul et (gerçek akışta da böyle).
                        return val;
                    }
                });

            _cryptoMock.Setup(c => c.GetKeyForUser(It.IsAny<int>()))
                .Returns(_mockKey);

            _cryptoMock.Setup(c => c.ComputeBlindIndex(It.IsAny<string>(), It.IsAny<byte[]>()))
                .Returns((string val, byte[] k) => val?.ToLowerInvariant() ?? string.Empty);

            _taskService = new TaskService(_context, _cryptoMock.Object, new Mock<Microsoft.Extensions.Logging.ILogger<TaskService>>().Object);
        }

        [Fact]
        public async Task CreateTaskAsync_ShouldEncryptDataBeforeSaving()
        {
            // Arrange
            var userId = 1;
            var task = new TaskItem
            {
                Title = "Test Task",
                Description = "Description",
                Tags = new List<string> { "tag1" }
            };

            // Act
            var result = await _taskService.CreateTaskAsync(userId, task);

            // Assert
            _context.Entry(result).State = EntityState.Detached; // Detach to force reload from DB
            var dbTask = await _context.Tasks.FindAsync(result.Id);
            Assert.NotNull(dbTask);
            var dbTitle = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(dbTask.Title));
            var dbDesc = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(dbTask.Description));
            Assert.StartsWith("enc_", dbTitle);
            Assert.StartsWith("enc_", dbDesc);
            Assert.Equal("Test Task", result.Title); // Result should be decrypted
        }

        [Fact]
        public async Task GetTasksAsync_ShouldReturnDecryptedTasks()
        {
            // Arrange
            var userId = 1;
            _context.Tasks.Add(new TaskItem 
            { 
                UserId = userId, 
                Title = Enc("Task 1"), 
                Description = Enc("Desc"), 
                TagsJson = Enc("[\"tag1\"]") 
            });
            await _context.SaveChangesAsync();

            // Act
            var (items, totalCount) = await _taskService.GetTasksAsync(userId, null, null, null, null, null, null);

            // Assert
            Assert.Single(items);
            Assert.Equal(1, totalCount);
            Assert.Equal("Task 1", items[0].Title);
            Assert.Equal("Desc", items[0].Description);
        }

        [Fact]
        public async Task GetTasksAsync_ShouldSortByPriority_RegardlessOfCaseAndCulture()
        {
            // Regresyon: tr-TR kültüründe "PRIORITY".ToLower() → "prıorıty" olur, hiçbir case
            // ile eşleşmez ve sıralama sessizce SortOrder'a düşerdi — hata yok, yanlış sıra var.
            var previous = CultureInfo.CurrentCulture;
            try
            {
                CultureInfo.CurrentCulture = new CultureInfo("tr-TR");
                var userId = 1;
                _context.Tasks.Add(new TaskItem { UserId = userId, Title = Enc("Low"), Priority = TaskPriority.Low, SortOrder = 1 });
                _context.Tasks.Add(new TaskItem { UserId = userId, Title = Enc("High"), Priority = TaskPriority.High, SortOrder = 2 });
                await _context.SaveChangesAsync();

                var (items, _) = await _taskService.GetTasksAsync(userId, null, null, "PRIORITY", null, null, null);

                // Priority azalan sıralanmalı: High önce gelmeli.
                Assert.Equal(TaskPriority.High, items[0].Priority);
            }
            finally
            {
                CultureInfo.CurrentCulture = previous;
            }
        }

        /// <summary>
        /// YER TUTUCU BAŞLIK GERİ YAZILAMAZ — sessiz veri kaybının koruması.
        ///
        /// Yaşanan zincir: başlık çözülemeyince istemciye "⚠️ Bu görev okunamıyor"
        /// gönderiliyordu; istemci bunu görevin BAŞLIĞI sanıp saklıyor, kullanıcı görevi
        /// tamamlayınca aynı metni geri gönderiyor ve sunucu onu gerçek başlık kabul edip
        /// ŞİFRELEYİP KAYDEDİYORDU. Orijinal şifreli metin kalıcı olarak siliniyordu.
        ///
        /// Üstelik hata kendi izini siliyordu: görev artık sorunsuz çözüldüğü için bir
        /// daha "Decrypt failed" uyarısı basılmıyordu.
        /// </summary>
        [Fact]
        public async Task UpdateTask_PlaceholderTitle_DoesNotOverwriteEncryptedContent()
        {
            var userId = 1;
            var originalCipher = Enc("Gerçek Başlık");
            var task = new TaskItem { UserId = userId, Title = originalCipher, Description = Enc("Gerçek Açıklama") };
            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();
            var id = task.Id;
            _context.ChangeTracker.Clear();

            await _taskService.UpdateTaskAsync(userId, id, new TaskItem
            {
                Title = TaskService.UnreadableTitlePlaceholder,
                Description = string.Empty,
                IsCompleted = true,
            });

            _context.ChangeTracker.Clear();
            var stored = await _context.Tasks.FindAsync(id);

            // İÇERİK DOKUNULMADAN kaldı — kayıt hâlâ kurtarılabilir.
            Assert.Equal(originalCipher, stored!.Title);
            Assert.Equal(Enc("Gerçek Açıklama"), stored.Description);

            // ÜST VERİ güncellendi: kullanıcı okuyamadığı bir görevi yine de tamamlayabilmeli.
            Assert.True(stored.IsCompleted);
        }

        /// <summary>
        /// Normal bir güncelleme hâlâ içeriği yazar — koruma fazla geniş olmamalı.
        /// </summary>
        [Fact]
        public async Task UpdateTask_NormalTitle_StillWritesContent()
        {
            var userId = 1;
            var task = new TaskItem { UserId = userId, Title = Enc("Eski"), Description = Enc("Eski Açıklama") };
            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();
            var id = task.Id;
            _context.ChangeTracker.Clear();

            await _taskService.UpdateTaskAsync(userId, id, new TaskItem
            {
                Title = "Yeni Başlık",
                Description = "Yeni Açıklama",
                IsCompleted = false,
            });

            _context.ChangeTracker.Clear();
            var stored = await _context.Tasks.FindAsync(id);
            Assert.Equal(Enc("Yeni Başlık"), stored!.Title);
        }

        /// <summary>
        /// OKUNAMAYAN GÖREV LİSTEDE GÖRÜNMEZ — ama silinmez de.
        ///
        /// Kullanıcı için "⚠️ Bu görev okunamıyor" satırının hiçbir değeri yok: içeriğini
        /// göremiyor, yapabileceği tek şey silmek. Uygulamanın iç sorununu kullanıcının
        /// ekranına taşıyordu. Daha kötüsü, görünür olduğu için ETKİLEŞİME giriyor ve o
        /// etkileşim veriyi yok ediyordu.
        ///
        /// Kayıt veritabanında DURUYOR: eski bir sır ENCRYPTION_KEY_LEGACY'ye eklenirse
        /// geri okunabilir. Gizlemek silmek değildir.
        /// </summary>
        [Fact]
        public async Task GetTasks_UnreadableTask_IsHiddenButNotDeleted()
        {
            var userId = 1;
            // 40+ karakter, geçerli base64 → şifreli sayılır; ama sahte çözücü bunu
            // çözemez (içinde "enc_" yok) → okunamaz kayıt.
            var corrupt = Convert.ToBase64String(new byte[48]);

            _context.Tasks.Add(new TaskItem { UserId = userId, Title = corrupt, Description = string.Empty });
            _context.Tasks.Add(new TaskItem { UserId = userId, Title = Enc("Sağlam Görev"), Description = string.Empty });
            await _context.SaveChangesAsync();

            var (items, total) = await _taskService.GetTasksAsync(userId, null, null, null, null, null, null);

            // Yalnız sağlam görev döndü.
            Assert.Single(items);
            Assert.Equal("Sağlam Görev", items[0].Title);

            // Yer tutucu kullanıcıya HİÇ ulaşmıyor.
            Assert.DoesNotContain(items, t => t.Title == TaskService.UnreadableTitlePlaceholder);

            // Toplam da düşüldü: sayfalayıcı olmayan bir kayda yer ayırmasın.
            Assert.Equal(1, total);

            // VERİ DURUYOR — gizlemek silmek değil.
            Assert.Equal(2, await _context.Tasks.CountAsync(t => t.UserId == userId));
        }

        /// <summary>
        /// KISA DÜZ METİN ŞİFRELİ SANILMAZ — veri kurtaran düzeltme.
        ///
        /// "Yoga" gibi kısa, ASCII ve uzunluğu 4'ün katı bir başlık base64 kurallarına
        /// uyar. Eski kontrol yalnızca "base64'e benziyor mu" diye baktığı için böyle
        /// başlıklar şifreli sanılıp çözülmeye çalışılıyor, hiçbir anahtar tutmuyor ve
        /// kullanıcıya "okunamıyor" diye dönüyordu — halbuki başlık sapasağlam oradaydı.
        ///
        /// Ayrım biçimden geliyor: Encrypt çıktısı IV(12)+veri+TAG(16) taşır, yani boş
        /// metin bile 40 karakterlik base64 üretir. Daha kısası şifreli OLAMAZ.
        /// </summary>
        [Theory]
        [InlineData("Yoga")]
        [InlineData("Ders")]
        [InlineData("Plan")]
        public async Task GetTasks_ShortPlaintextTitle_IsReturnedAsIs(string plainTitle)
        {
            var userId = 1;
            _context.Tasks.Add(new TaskItem { UserId = userId, Title = plainTitle, Description = string.Empty });
            await _context.SaveChangesAsync();

            var (items, _) = await _taskService.GetTasksAsync(userId, null, null, null, null, null, null);

            Assert.Equal(plainTitle, items[0].Title);
            Assert.NotEqual(TaskService.UnreadableTitlePlaceholder, items[0].Title);
        }

        /// <summary>
        /// Sahte şifreli metin — GERÇEK biçimin yükünü taşır (IV 12 + TAG 16 = 28 bayt).
        ///
        /// Yük olmadan üretilen dizeler gerçek AES-GCM çıktısının asla olamayacağı kadar
        /// kısa kalıyordu ve `SafeDecrypt`in "bu düz metin mi şifreli mi" kontrolünü
        /// yanlış tarafa düşürüyordu. Testin şifreli veriyi doğrudan veritabanına
        /// tohumladığı yerlerde de bu yardımcı kullanılmalı.
        /// </summary>
        private static string Enc(string value)
        {
            var body = System.Text.Encoding.UTF8.GetBytes("enc_" + value);
            var buf = new byte[28 + body.Length];
            Buffer.BlockCopy(body, 0, buf, 28, body.Length);
            return Convert.ToBase64String(buf);
        }
    }
}
