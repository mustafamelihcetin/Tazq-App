using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    public class TaskService : ITaskService
    {
        private readonly AppDbContext _context;
        private readonly ICryptoService _cryptoService;
        private readonly ILogger<TaskService> _logger;

        public TaskService(AppDbContext context, ICryptoService cryptoService, ILogger<TaskService> logger)
        {
            _context = context;
            _cryptoService = cryptoService;
            _logger = logger;
        }

        public async Task<(List<TaskItem> Items, int TotalCount)> GetTasksAsync(int userId, string? tag, string? search, string? sortBy, bool? isCompleted, DateTime? startDate, DateTime? endDate, int page = 1, int pageSize = 50)
        {
            var query = _context.Tasks.AsNoTracking().Where(t => t.UserId == userId).AsQueryable();
            var key = _cryptoService.GetKeyForUser(userId)!;

            // Apply filters that can be done at DB level
            if (isCompleted.HasValue)
                query = query.Where(t => t.IsCompleted == isCompleted.Value);

            if (startDate.HasValue)
                query = query.Where(t => t.DueDate >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(t => t.DueDate <= endDate.Value);

            // 1. Tag Filtering using Blind Index
            if (!string.IsNullOrEmpty(tag))
            {
                var tagHash = _cryptoService.ComputeBlindIndex(tag, key);
                if (!string.IsNullOrEmpty(tagHash))
                {
                    query = query.Where(t => t.TagsBlindIndex != null && t.TagsBlindIndex.Contains(tagHash));
                }
            }

            // 2. Search Filtering using Blind Index
            if (!string.IsNullOrEmpty(search))
            {
                var searchWords = System.Text.RegularExpressions.Regex.Split(search.ToLowerInvariant(), @"[^\p{L}\p{N}]+")
                    .Where(w => !string.IsNullOrWhiteSpace(w))
                    .Distinct()
                    .ToList();

                if (searchWords.Count > 0)
                {
                    using var hmac = new System.Security.Cryptography.HMACSHA256(key);
                    foreach (var word in searchWords)
                    {
                        byte[] wordHashBytes = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(word));
                        string wordHash = Convert.ToBase64String(wordHashBytes);
                        
                        query = query.Where(t => t.TitleBlindIndex != null && t.TitleBlindIndex.Contains(wordHash));
                    }
                }
            }

            var totalCount = await query.CountAsync();
            
            // Sort at DB level on non-encrypted fields
            // ToLowerInvariant: tr-TR kültüründe "PRIORITY".ToLower() → "prıorıty" olur ve
            // eşleşmez; sıralama sessizce varsayılana düşerdi (yanlış sıra, hata yok).
            query = sortBy?.ToLowerInvariant() switch
            {
                "duedate" => query.OrderBy(t => t.DueDate),
                "priority" => query.OrderByDescending(t => t.Priority),
                _ => query.OrderByDescending(t => t.SortOrder)
            };

            var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            /*
              OKUNAMAYAN KAYITLAR KULLANICIYA GÖSTERİLMEZ.

              Önceden bunlar "⚠️ Bu görev okunamıyor — silebilirsin" başlığıyla listede
              duruyordu. Kullanıcı açısından bu satırın hiçbir değeri yok: içeriğini
              göremiyor, ne olduğunu hatırlayamıyor, yapabileceği tek şey silmek. Yani
              uygulamanın iç sorununu kullanıcının ekranına taşıyan bir satırdı.

              Daha kötüsü: görünür olduğu için ETKİLEŞİME giriyordu ve o etkileşim veriyi
              yok ediyordu (bkz. UpdateTaskAsync — yer tutucu geri gönderilip gerçek
              başlık olarak kaydediliyordu).

              Artık listeden çıkarılıyor ama VERİTABANINDAN SİLİNMİYOR: kayıt yerinde
              duruyor ve bir gün eski bir sır ENCRYPTION_KEY_LEGACY'ye eklenirse geri
              okunabilir. Sorunun tek izi log — teşhis için yeterli, kullanıcı için gürültü.
            */
            var readable = new List<TaskItem>(items.Count);
            var unreadable = 0;
            foreach (var item in items)
            {
                if (DecryptTask(item, key)) readable.Add(item);
                else unreadable++;
            }

            if (unreadable > 0)
            {
                _logger.LogWarning(
                    "User {UserId}: {Count} görev çözülemedi ve listeden GİZLENDİ (veri silinmedi).",
                    userId, unreadable);
            }

            // Toplam da düşülüyor: sayfada gösterilmeyen satır sayıya dahil edilirse
            // sayfalayıcı olmayan bir kayda yer ayırır.
            return (readable, Math.Max(0, totalCount - unreadable));
        }


        public async Task<TaskItem?> GetTaskByIdAsync(int userId, int taskId)
        {
            var task = await _context.Tasks.AsNoTracking().FirstOrDefaultAsync(t => t.Id == taskId);
            if (task == null || task.UserId != userId)
                return null;

            var key = _cryptoService.GetKeyForUser(userId)!;
            // Okunamayan kayıt "yok" sayılır: yer tutucu bir görev döndürmek, istemciye
            // düzenleyebileceği bir şey varmış izlenimi verirdi.
            if (!DecryptTask(task, key))
            {
                _logger.LogWarning("Task {TaskId} çözülemedi — tekil istekte gizlendi.", task.Id);
                return null;
            }
            return task;
        }

        /// <summary>
        /// AKTİF (tamamlanmamış) görev tavanı — kullanıcının "çalışma seti" sınırı.
        ///
        /// NEDEN tamamlananlar sayılmaz: eski sayım TÜM satırları sayıyordu. 6 ay aktif kullanan,
        /// 200 görev TAMAMLAMIŞ gerçek bir kullanıcı yeni görev ekleyemez hâle geliyordu — kota
        /// kötüye kullanımı değil, başarıyı cezalandırıyordu. Sunucuyu koruyan şey açık görev
        /// sayısıdır; tamamlanan görev kullanıcının geçmişidir.
        /// </summary>
        private const int MaxActiveTasksPerUser = 200;

        /// <summary>
        /// TOPLAM satır tavanı — depolama emniyet freni (patolojik kötüye kullanım).
        /// Aktif tavan çalışma setini zaten sınırlar; bu yalnızca "sonsuz oluştur-tamamla"
        /// döngüsüyle satır şişirmeyi durdurur. Gerçek kullanıcı pratikte buna çarpmaz.
        /// </summary>
        private const int MaxTotalTasksPerUser = 5000;

        private const int MaxSubtasksPerTask = 15;
        private const int MaxTagsPerTask = 8;

        // Alan uzunluk tavanları — görev BAŞINA depolama sınırı. Şifrelemeden ÖNCE (düz metinde)
        // uygulanır; yoksa tek görev megabaytlarca not taşıyabilirdi (satır tavanı tek başına yetmez).
        private const int MaxTitleLength = 200;
        private const int MaxDescriptionLength = 5000;

        private static string Clamp(string? value, int max) =>
            string.IsNullOrEmpty(value) ? string.Empty : (value.Length <= max ? value : value.Substring(0, max));

        /// <summary>Kota + alan sınırlarını uygular. Aşımda InvalidOperationException fırlatır.</summary>
        private async Task EnforceQuotaAsync(int userId, int adding)
        {
            var activeCount = await _context.Tasks.CountAsync(t => t.UserId == userId && !t.IsCompleted);
            if (activeCount + adding > MaxActiveTasksPerUser)
                throw new InvalidOperationException($"TASK_LIMIT_REACHED:{MaxActiveTasksPerUser}");

            var totalCount = await _context.Tasks.CountAsync(t => t.UserId == userId);
            if (totalCount + adding > MaxTotalTasksPerUser)
                throw new InvalidOperationException($"TASK_STORAGE_LIMIT_REACHED:{MaxTotalTasksPerUser}");
        }

        private static void ClampFields(TaskItem t)
        {
            t.Title = Clamp(t.Title, MaxTitleLength);
            t.Description = Clamp(t.Description, MaxDescriptionLength);
            t.Tags = (t.Tags ?? new List<string>()).Take(MaxTagsPerTask).ToList();
            t.Subtasks = (t.Subtasks ?? new List<SubtaskItem>()).Take(MaxSubtasksPerTask).ToList();
        }

        public async Task<TaskItem> CreateTaskAsync(int userId, TaskItem task)
        {
            // Idempotency: ağ kopması/timeout sonrası istemci aynı görevi tekrar
            // gönderebilir. Aynı kullanıcıda tamamlanmamış aynı ClientKey'li görev
            // varsa yenisini oluşturmadan mevcudu döndür (at-least-once → exactly-once).
            if (!string.IsNullOrEmpty(task.ClientKey))
            {
                var existing = await _context.Tasks
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.UserId == userId
                        && t.ClientKey == task.ClientKey
                        && !t.IsCompleted);
                if (existing != null)
                {
                    var existingKey = _cryptoService.GetKeyForUser(userId)!;
                    DecryptTask(existing, existingKey);
                    return existing;
                }
            }

            await EnforceQuotaAsync(userId, 1);

            task.UserId = userId;
            ClampFields(task);

            // Ensure UTC for Postgres timestamptz compatibility
            if (task.DueDate.HasValue && task.DueDate.Value.Kind == DateTimeKind.Unspecified)
                task.DueDate = DateTime.SpecifyKind(task.DueDate.Value, DateTimeKind.Utc);
            if (task.DueTime.HasValue && task.DueTime.Value.Kind == DateTimeKind.Unspecified)
                task.DueTime = DateTime.SpecifyKind(task.DueTime.Value, DateTimeKind.Utc);

            var key = _cryptoService.GetKeyForUser(userId)!;
            EncryptTask(task, key);

            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();

            // Decrypt for returning to client
            DecryptTask(task, key);
            return task;
        }

        public async Task<bool> CreateTasksBulkAsync(int userId, List<TaskItem> tasks)
        {
            // Toplu ekleme (mod planları): kotaya SIĞDIĞI KADARINI ekler — hepsini reddetmez.
            // Aktif tavan ve toplam tavan ayrı ayrı kırpar; hangisi darsa o belirler.
            var activeCount = await _context.Tasks.CountAsync(t => t.UserId == userId && !t.IsCompleted);
            var totalCount = await _context.Tasks.CountAsync(t => t.UserId == userId);
            var allowed = Math.Min(MaxActiveTasksPerUser - activeCount, MaxTotalTasksPerUser - totalCount);
            if (allowed <= 0)
                return false;
            tasks = tasks.Take(allowed).ToList();

            var key = _cryptoService.GetKeyForUser(userId)!;

            foreach (var t in tasks)
            {
                t.UserId = userId;
                ClampFields(t);
                EncryptTask(t, key);
            }

            await _context.Tasks.AddRangeAsync(tasks);
            return await _context.SaveChangesAsync() > 0;
        }

        public async Task<TaskItem?> UpdateTaskAsync(int userId, int taskId, TaskItem updatedTask)
        {
            var task = await _context.Tasks.FindAsync(taskId);
            if (task == null || task.UserId != userId)
                return null;

            var key = _cryptoService.GetKeyForUser(userId)!;

            var wasCompleted = task.IsCompleted;

            /*
              GÖSTERİM YER TUTUCUSU GERİ YAZILAMAZ — sessiz veri kaybının kaynağıydı.

              Zincir şuydu: başlık çözülemeyince istemciye "⚠️ Bu görev okunamıyor"
              gönderiliyor, istemci bunu görevin BAŞLIĞI sanıyor ve saklıyor. Kullanıcı o
              görevi tamamladığında (ya da herhangi bir güncelleme yaptığında) istemci tüm
              görevi geri gönderiyor — yer tutucu dahil. Burası da onu gerçek başlık kabul
              edip ŞİFRELEYİP KAYDEDİYORDU.

              Sonuç: orijinal şifreli metin kalıcı olarak siliniyor. Görev artık sorunsuz
              çözülüyor (çünkü içinde gerçekten o cümle yazıyor), bu yüzden bir daha
              "Decrypt failed" uyarısı da basılmıyor — hata kendi izini siliyordu.

              Kural: yer tutucu bir GÖRÜNTÜdür, veri değildir. Geldiğinde ŞİFRELİ ALANLAR
              OLDUĞU GİBİ KORUNUR; kayıt kurtarılabilir kalır (ör. eski bir sır
              ENCRYPTION_KEY_LEGACY'ye eklenirse geri okunur).

              AMA ÜST VERİ GÜNCELLENİR: kullanıcı okuyamadığı bir görevi yine de
              tamamlayabilmeli, tarihini değiştirebilmeli. Donduran şey yalnız içerik.
            */
            var titleIsPlaceholder = updatedTask.Title == UnreadableTitlePlaceholder;

            // Özgün ŞİFRELİ değerler — `EncryptTask` sonrası geri konacak.
            // Not: burada `task.*` alanları henüz ŞİFRELİ (bu metotta çözülmüyorlar).
            var keepTitle = task.Title;
            var keepDescription = task.Description;
            var keepTagsJson = task.TagsJson;
            var keepSubtasksJson = task.SubtasksJson;
            var keepTitleBlind = task.TitleBlindIndex;
            var keepTagsBlind = task.TagsBlindIndex;

            task.Title = updatedTask.Title;
            task.Description = updatedTask.Description;

            // Ensure UTC for Postgres timestamptz compatibility
            var finalDueDate = updatedTask.DueDate;
            if (finalDueDate.HasValue && finalDueDate.Value.Kind == DateTimeKind.Unspecified)
                finalDueDate = DateTime.SpecifyKind(finalDueDate.Value, DateTimeKind.Utc);
            
            var finalDueTime = updatedTask.DueTime;
            if (finalDueTime.HasValue && finalDueTime.Value.Kind == DateTimeKind.Unspecified)
                finalDueTime = DateTime.SpecifyKind(finalDueTime.Value, DateTimeKind.Utc);

            task.DueDate = finalDueDate;
            task.DueTime = finalDueTime;
            task.IsCompleted = updatedTask.IsCompleted;
            task.Priority = updatedTask.Priority;
            task.Tags = (updatedTask.Tags ?? new List<string>()).Take(MaxTagsPerTask).ToList();
            task.Subtasks = (updatedTask.Subtasks ?? new List<SubtaskItem>()).Take(MaxSubtasksPerTask).ToList();
            task.Recurrence = updatedTask.Recurrence;
            task.SortOrder = updatedTask.SortOrder;

            EncryptTask(task, key);

            if (titleIsPlaceholder)
            {
                /*
                  ÇİFT ŞİFRELEME TUZAĞI: `EncryptTask` koşulsuz şifreliyor. Başlığı hiç
                  yazmayıp bırakmak yetmezdi — o durumda alanda zaten ŞİFRELİ metin
                  duruyor olurdu ve bir kez daha şifrelenirdi. İki kat şifrelenen veri
                  doğru anahtarla bile tek geçişte çözülemez; yani "kurtarmak için"
                  yazılan kod veriyi büsbütün gömerdi.

                  Bu yüzden şifreleme normal akışta çalışıyor, ardından içerik alanları
                  özgün hâline geri konuyor. Kör indeksler de geri alınıyor: yer
                  tutucudan üretilmiş bir arama indeksi, görevi "okunamıyor" kelimesiyle
                  aranır yapardı.
                */
                task.Title = keepTitle;
                task.Description = keepDescription;
                task.TagsJson = keepTagsJson;
                task.SubtasksJson = keepSubtasksJson;
                task.TitleBlindIndex = keepTitleBlind;
                task.TagsBlindIndex = keepTagsBlind;

                _logger.LogWarning(
                    "Task {TaskId}: yer tutucu başlık geri gönderildi — içerik YAZILMADI, özgün şifreli veri korundu.",
                    task.Id);
            }

            _context.Tasks.Update(task);
            await _context.SaveChangesAsync();

            // Auto-create next recurring task when completed
            if (!wasCompleted && task.IsCompleted && task.Recurrence != RecurrenceType.None)
            {
                DecryptTask(task, key);
                await CreateNextRecurrence(userId, task, key);
            }

            DecryptTask(task, key);
            return task;
        }

        public async Task<bool> DeleteTaskAsync(int userId, int taskId)
        {
            var task = await _context.Tasks.FindAsync(taskId);
            if (task == null || task.UserId != userId)
                return false;

            _context.Tasks.Remove(task);
            return await _context.SaveChangesAsync() > 0;
        }

        public async Task<bool> ReorderTasksAsync(int userId, List<int> orderedIds)
        {
            if (orderedIds == null || orderedIds.Count == 0) return false;

            var tasks = await _context.Tasks
                .Where(t => t.UserId == userId && orderedIds.Contains(t.Id))
                .ToListAsync();

            if (tasks.Count == 0) return false;

            var taskMap = tasks.ToDictionary(t => t.Id);

            for (int i = 0; i < orderedIds.Count; i++)
            {
                var id = orderedIds[i];
                if (taskMap.TryGetValue(id, out var task))
                {
                    task.SortOrder = i;
                }
            }

            await _context.SaveChangesAsync();
            return true;
        }

        private async System.Threading.Tasks.Task CreateNextRecurrence(int userId, TaskItem source, byte[] key)
        {
            var nextDate = source.Recurrence switch
            {
                RecurrenceType.Daily => source.DueDate?.AddDays(1),
                RecurrenceType.Weekly => source.DueDate?.AddDays(7),
                RecurrenceType.Monthly => source.DueDate?.AddMonths(1),
                _ => null
            };

            if (nextDate == null) return;

            var newTask = new TaskItem
            {
                Title = source.Title,
                Description = source.Description,
                DueDate = nextDate.Value.Kind == DateTimeKind.Unspecified
                    ? DateTime.SpecifyKind(nextDate.Value, DateTimeKind.Utc) : nextDate,
                DueTime = source.DueTime,
                IsCompleted = false,
                Priority = source.Priority,
                Tags = source.Tags ?? new List<string>(),
                Subtasks = (source.Subtasks ?? new List<SubtaskItem>())
                    .Select(s => new SubtaskItem { Text = s.Text, Done = false }).ToList(),
                Recurrence = source.Recurrence,
                SortOrder = source.SortOrder,
                UserId = userId
            };

            EncryptTask(newTask, key);
            _context.Tasks.Add(newTask);
            await _context.SaveChangesAsync();
        }

        private void EncryptTask(TaskItem task, byte[] key)
        {
            // Compute blind indexes using plaintext before encryption
            task.TitleBlindIndex = _cryptoService.ComputeBlindIndex(task.Title, key);
            var tagsText = string.Join(" ", task.Tags ?? new List<string>());
            task.TagsBlindIndex = _cryptoService.ComputeBlindIndex(tagsText, key);

            task.Title = _cryptoService.Encrypt(task.Title, key);
            task.Description = _cryptoService.Encrypt(task.Description ?? string.Empty, key);
            var jsonTags = JsonSerializer.Serialize(task.Tags ?? new List<string>());
            task.TagsJson = _cryptoService.Encrypt(jsonTags, key);
            var jsonSubtasks = JsonSerializer.Serialize(task.Subtasks ?? new List<SubtaskItem>());
            task.SubtasksJson = _cryptoService.Encrypt(jsonSubtasks, key);
        }

        // Bir alanın şifresini güvenle çözer: hata olursa TÜM isteği düşürmek yerine
        // o alanı atlar, anlamlı bir uyarı loglar (task id + alan + sebep) ve null döner.
        // Böylece tek bir bozuk satır (ör. eski/hasarlı şifreli veri) bütün görev
        // listesini 500'e düşürmez — kalan görevler normal yüklenir.
        /// <summary>
        /// Şifreli alanı çözer. Geçerli anahtar tutmazsa ESKİ anahtarları dener.
        ///
        /// Neden eski anahtarlar: şifreleme anahtarı değişince eski veri okunamaz hale
        /// gelir. Uygulamada bu yaşandı — ENCRYPTION_KEY tanımlı olmadığı için şifreleme
        /// sessizce JWT anahtarına düşüyordu ve JWT (doğru olarak) döndürülebilen bir sır.
        /// Kullanıcı sonucu "⚠️ (çözülemeyen başlık)" olarak gördü.
        ///
        /// AES-GCM'in doğrulama etiketi (tag) burada işimize yarıyor: yanlış anahtarla
        /// çözme sessizce çöp üretmez, EXCEPTION atar. Yani "denemek" güvenli —
        /// yanlış anahtarla yanlış düz metin döndürme riski yok.
        /// </summary>
        private string? SafeDecrypt(string? cipher, byte[] key, IReadOnlyList<byte[]> legacyKeys, int taskId, string field)
        {
            if (string.IsNullOrEmpty(cipher)) return string.Empty;

            /*
              DÜZ METİN Mİ ŞİFRELİ Mİ — uzunluk kesin cevap veriyor.

              Eski kontrol yalnızca "base64'e benziyor mu" diye bakıyordu ve bu YETERSİZ:
              kısa, ASCII, uzunluğu 4'ün katı bir düz metin başlık ("Yoga", "Ders", "Plan")
              base64 kurallarına uyar. Böyle bir başlık şifreli sanılıp çözülmeye
              çalışılıyor, hiçbir anahtar tutmuyor ve kullanıcıya "⚠️ Bu görev okunamıyor"
              diye dönüyordu — halbuki başlık orada, sapasağlam duruyordu.

              Kesin ayrım biçimden geliyor: Encrypt çıktısı IV(12) + veri + TAG(16), yani
              BOŞ metin bile en az 28 bayt → 40 karakterlik base64 üretir. Demek ki 40
              karakterden kısa bir dize bu sistemin şifreli çıktısı OLAMAZ; düz metindir.

              Bu bir tahmin değil, çıktı biçiminin doğrudan sonucu. Yanlış tarafa düşme
              riski de yok: 40 karakterden uzun gerçek düz metinler zaten neredeyse her
              zaman boşluk ya da base64 dışı karakter içerir ve ilk kapıdan geçer.
            */
            const int MinCipherBase64Length = 40; // ceil((12 + 0 + 16) / 3) * 4

            if ((cipher.StartsWith('[') && cipher.EndsWith(']'))
                || !IsBase64String(cipher)
                || cipher.Length < MinCipherBase64Length)
            {
                return cipher;
            }

            try
            {
                return _cryptoService.Decrypt(cipher, key);
            }
            catch
            {
                // Geçerli anahtar tutmadı — eski sırları dene.
            }

            // Null'a dayanıklı: bu metodun tüm amacı "tek bozuk satır bütün listeyi
            // 500'e düşürmesin". Eski anahtar listesinin kendisi eksik gelirse de aynı
            // güvence geçerli olmalı — burada çökmek, korumaya çalıştığı şeyi bozardı.
            var legacy = legacyKeys ?? (IReadOnlyList<byte[]>)Array.Empty<byte[]>();

            for (int i = 0; i < legacy.Count; i++)
            {
                try
                {
                    var plain = _cryptoService.Decrypt(cipher, legacy[i]);
                    // SESSİZ GEÇMİYORUZ: bu kayıt eski bir anahtarla yazılmış ve hâlâ öyle
                    // duruyor. Okunuyor ama borç: eski sır yapılandırmadan çıkarıldığı gün
                    // ölür. Log, yeniden şifreleme ihtiyacının tek görünür izi.
                    _logger.LogWarning(
                        "Task {TaskId} field {Field} ESKİ anahtarla çözüldü (#{Index}). Yeniden şifrelenmeli.",
                        taskId, field, i);
                    return plain;
                }
                catch { /* sıradaki eski anahtarı dene */ }
            }

            _logger.LogWarning(
                "Decrypt failed for Task {TaskId} field {Field}: geçerli ve {Count} eski anahtarın hiçbiri tutmadı.",
                taskId, field, legacy.Count);
            return null;
        }

        private bool IsBase64String(string s)
        {
            if (string.IsNullOrEmpty(s) || s.Length % 4 != 0 || s.Contains(' ') || s.Contains('\t') || s.Contains('\r') || s.Contains('\n'))
                return false;
            try
            {
                Convert.FromBase64String(s);
                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Çözülemeyen başlık için GÖSTERİM yer tutucusu — asla kaydedilmez.
        ///
        /// Sabit olması şart: `UpdateTaskAsync` gelen başlığı bununla karşılaştırıp
        /// reddediyor. İki yerde ayrı ayrı yazılsaydı biri değiştiğinde karşılaştırma
        /// sessizce tutmaz ve aşağıda anlatılan veri kaybı geri dönerdi.
        /// </summary>
        public const string UnreadableTitlePlaceholder = "⚠️ Bu görev okunamıyor — silebilirsin";

        /// <returns>Başlık çözülebildiyse <c>true</c>. <c>false</c> ise kayıt bozuk — listeye girmemeli.</returns>
        private bool DecryptTask(TaskItem task, byte[] key)
        {
            // Eski sırlar tanımlıysa onlarla da denenir — anahtar döndürüldüğünde veri ölmesin.
            var legacy = _cryptoService.GetLegacyKeysForUser(task.UserId);

            // Title çözülemezse görev yine listede görünsün (silinmesin) — yer-tutucu başlık.
            // Metin KULLANICI diliyle: "(çözülemeyen başlık)" bir geliştirici cümlesiydi ve
            // kullanıcıya iç hatayı sızdırıyordu. Kullanıcının yapabileceği tek şey silmek;
            // o yüzden cümle onu söylüyor.
            var decryptedTitle = SafeDecrypt(task.Title, key, legacy, task.Id, "Title");
            var readable = decryptedTitle != null;
            task.Title = decryptedTitle ?? UnreadableTitlePlaceholder;
            task.Description = SafeDecrypt(task.Description, key, legacy, task.Id, "Description") ?? string.Empty;

            var decryptedTags = SafeDecrypt(task.TagsJson, key, legacy, task.Id, "Tags");
            task.Tags = TryDeserialize<List<string>>(decryptedTags) ?? new List<string>();

            var decryptedSubs = SafeDecrypt(task.SubtasksJson, key, legacy, task.Id, "Subtasks");
            task.Subtasks = TryDeserialize<List<SubtaskItem>>(decryptedSubs) ?? new List<SubtaskItem>();

            return readable;
        }

        private T? TryDeserialize<T>(string? json) where T : class
        {
            if (string.IsNullOrEmpty(json)) return null;
            try { return JsonSerializer.Deserialize<T>(json); }
            catch (Exception ex) { _logger.LogWarning("JSON parse failed: {Error}", ex.Message); return null; }
        }
    }
}
