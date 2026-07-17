using Microsoft.EntityFrameworkCore;
using Moq;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// Görev kotası — sunucuyu korurken GERÇEK kullanıcıyı cezalandırmamalı.
    ///
    /// Eski davranış TÜM satırları sayıyordu: 200 görev TAMAMLAMIŞ aktif bir kullanıcı yeni
    /// görev ekleyemez hâle geliyordu (kota, kötüye kullanımı değil başarıyı cezalandırıyordu).
    /// Yeni tasarım: AKTİF (tamamlanmamış) görev tavanı + yüksek TOPLAM depolama freni +
    /// alan uzunluk tavanları.
    /// </summary>
    public class TaskQuotaTests
    {
        private readonly AppDbContext _context;
        private readonly TaskService _taskService;
        private readonly byte[] _mockKey = new byte[32];

        public TaskQuotaTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new AppDbContext(options);

            // Şifreleme kimlik fonksiyonu — bu testlerin konusu kota, kripto değil.
            var cryptoMock = new Mock<ICryptoService>();
            cryptoMock.Setup(c => c.Encrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
                .Returns((string val, byte[] k) => val ?? string.Empty);
            cryptoMock.Setup(c => c.Decrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
                .Returns((string val, byte[] k) => val ?? string.Empty);
            cryptoMock.Setup(c => c.GetKeyForUser(It.IsAny<int>())).Returns(_mockKey);
            cryptoMock.Setup(c => c.ComputeBlindIndex(It.IsAny<string>(), It.IsAny<byte[]>()))
                .Returns((string val, byte[] k) => val?.ToLowerInvariant() ?? string.Empty);

            _taskService = new TaskService(
                _context,
                cryptoMock.Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<TaskService>>().Object);
        }

        private void Seed(int userId, int count, bool completed)
        {
            for (int i = 0; i < count; i++)
                _context.Tasks.Add(new TaskItem { UserId = userId, Title = $"t{i}", Description = string.Empty, IsCompleted = completed });
            _context.SaveChanges();
        }

        [Fact]
        public async Task CompletedTasks_DoNotBlockNewTask()
        {
            // Asıl regresyon: 200 TAMAMLANMIŞ görevi olan kullanıcı eskiden kilitleniyordu.
            Seed(userId: 1, count: 200, completed: true);

            var created = await _taskService.CreateTaskAsync(1, new TaskItem { Title = "yeni", Description = string.Empty });

            Assert.NotNull(created);
            Assert.Equal(201, await _context.Tasks.CountAsync(t => t.UserId == 1));
        }

        [Fact]
        public async Task ActiveLimitReached_ThrowsLimitSignal()
        {
            Seed(userId: 2, count: 200, completed: false);

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(
                () => _taskService.CreateTaskAsync(2, new TaskItem { Title = "fazla", Description = string.Empty }));

            // Controller bu ön eki 429'a çevirir.
            Assert.StartsWith("TASK_LIMIT_REACHED", ex.Message);
        }

        [Fact]
        public async Task CompletingTask_FreesActiveQuota()
        {
            // Kota dolu → bir görev tamamlanınca yer açılmalı (yaşam döngüsü doğru işlemeli).
            Seed(userId: 7, count: 200, completed: false);
            var first = await _context.Tasks.FirstAsync(t => t.UserId == 7);
            first.IsCompleted = true;
            await _context.SaveChangesAsync();

            var created = await _taskService.CreateTaskAsync(7, new TaskItem { Title = "yer açıldı", Description = string.Empty });

            Assert.NotNull(created);
        }

        [Fact]
        public async Task LongTitleAndDescription_AreClamped()
        {
            // Satır tavanı tek başına yetmez: tek görev megabaytlarca not taşıyabilirdi.
            var created = await _taskService.CreateTaskAsync(3, new TaskItem
            {
                Title = new string('a', 500),
                Description = new string('b', 10_000),
            });

            Assert.Equal(200, created.Title.Length);
            Assert.Equal(5000, created.Description.Length);
        }

        [Fact]
        public async Task Bulk_FillsOnlyRemainingActiveQuota()
        {
            Seed(userId: 4, count: 195, completed: false);

            var batch = Enumerable.Range(0, 20)
                .Select(i => new TaskItem { Title = $"b{i}", Description = string.Empty }).ToList();

            var ok = await _taskService.CreateTasksBulkAsync(4, batch);

            Assert.True(ok);
            // 195 + 5 = 200 (tavan), fazlası sessizce kırpılır — mod planı tamamen reddedilmez.
            Assert.Equal(200, await _context.Tasks.CountAsync(t => t.UserId == 4 && !t.IsCompleted));
        }

        [Fact]
        public async Task Bulk_ReturnsFalse_WhenActiveQuotaFull()
        {
            Seed(userId: 5, count: 200, completed: false);

            var ok = await _taskService.CreateTasksBulkAsync(5, new List<TaskItem>
            {
                new TaskItem { Title = "x", Description = string.Empty },
            });

            Assert.False(ok);
        }

        [Fact]
        public async Task Bulk_CompletedTasksDoNotConsumeActiveQuota()
        {
            // 300 tamamlanmış görev aktif kotayı yemez → mod planı yine kurulabilir.
            Seed(userId: 6, count: 300, completed: true);

            var batch = Enumerable.Range(0, 10)
                .Select(i => new TaskItem { Title = $"c{i}", Description = string.Empty }).ToList();

            Assert.True(await _taskService.CreateTasksBulkAsync(6, batch));
            Assert.Equal(10, await _context.Tasks.CountAsync(t => t.UserId == 6 && !t.IsCompleted));
        }
    }
}
