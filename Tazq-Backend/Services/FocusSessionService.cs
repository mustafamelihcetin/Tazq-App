using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    public class FocusSessionService : IFocusSessionService
    {
        private readonly AppDbContext _db;
        private readonly ICryptoService? _crypto;

        /// <param name="crypto">
        /// 2026-11-01: görev adı (TaskName) ŞİFRELİ yazılır — görevin kendi başlığı şifreliyken aynı ad odak
        /// kaydında düz metin duruyordu (korumayı deliyordu). Kullanıcıya dönen seans listesi adı hiç
        /// içermez; admin/ihraç görevlerdeki gibi saklandığı hâliyle görür. Testler crypto'suz kurabilir.
        /// </param>
        public FocusSessionService(AppDbContext db, ICryptoService? crypto = null)
        {
            _db = db;
            _crypto = crypto;
        }

        /*
          ODAK OTURUMU ALANLARI SINIRSIZDI — gövde ne diyorsa o kaydediliyordu.

          İki ayrı sorun vardı:

          1) `TaskName` uzunluk sınırsız. Sütun `text`; yani tek bir istekle megabaytlarca
             veri yazılabiliyordu. Görev başlıklarının kendi tavanı 200 karakter
             (TaskService.MaxTitleLength) ve bu alan ya o başlığı ya da sabit 'Focus'
             dizesini taşıyor — 200 gerçek kullanımın tam üstü.

          2) `DurationMinutes` işaretli ve sınırsız. Asıl zarar depolama değil, İSTATİSTİK:
             GetUserStatsAsync tüm oturumları toplayıp `totalFocusHours` üretiyor. Tek bir
             `int.MaxValue` gönderimi kullanıcının toplam odak süresini kalıcı olarak
             saçmalaştırır; negatif değer ise toplamı AŞAĞI çekip önceki gerçek oturumları
             görünmez kılar. İkisi de sessizdir — kimse hata görmez, sayı yanlıştır.
             [0, 1440] = en fazla bir gün; meşru bir odak oturumu bunun çok altında.

          Reddetmek yerine kırpmak bilinçli: oturum kaydı, kullanıcının BİTİRDİĞİ bir işin
          arkasından atılıyor ve istemci sonucu beklemiyor (`.catch(swallow)`). Reddetmek,
          gerçek bir oturumu sessizce kaybettirirdi.
        */
        private const int MaxTaskNameLength = 200;
        private const int MaxDurationMinutes = 24 * 60;

        public async Task<FocusSession> SaveSessionAsync(int userId, string taskName, int durationMinutes, bool completed, int? pausedSeconds = null)
        {
            var stored = StoreName(userId, taskName);

            var session = new FocusSession
            {
                UserId = userId,
                TaskName = stored,
                DurationMinutes = Math.Clamp(durationMinutes, 0, MaxDurationMinutes),
                Completed = completed,
                StartedAt = DateTime.UtcNow,
                PausedSeconds = pausedSeconds.HasValue ? Math.Clamp(pausedSeconds.Value, 0, MaxDurationMinutes * 60) : null
            };
            _db.FocusSessions.Add(session);
            await _db.SaveChangesAsync();
            return session;
        }

        private const int MaxAddMinutes = 60;
        private const string AnonymousTaskName = "Focus";

        public async Task<bool> UpdateSessionAsync(int userId, int sessionId, string? taskName, int? addMinutes)
        {
            var session = await _db.FocusSessions.FirstOrDefaultAsync(f => f.Id == sessionId && f.UserId == userId);
            if (session == null) return false;
            if (!string.IsNullOrWhiteSpace(taskName)) session.TaskName = StoreName(userId, taskName);
            if (addMinutes.HasValue)
                session.DurationMinutes = Math.Clamp(session.DurationMinutes + Math.Clamp(addMinutes.Value, 0, MaxAddMinutes), 0, MaxDurationMinutes);
            await _db.SaveChangesAsync();
            return true;
        }

        private string StoreName(int userId, string? taskName)
        {
            var name = (taskName ?? string.Empty).Trim();
            if (name.Length > MaxTaskNameLength) name = name[..MaxTaskNameLength];
            // Boş ad şifrelenmez (anlamsız, ve "boş mu" bilgisini gizlemeye değmez).
            return _crypto != null && name.Length > 0 ? _crypto.Encrypt(name, _crypto.GetKeyForUser(userId)) : name;
        }

        /// <summary>Saklı adı açar; açılamıyorsa ad yok sayılır, seans yine görünür. Sabit "Focus" adsız demektir.</summary>
        private string? ReadName(int userId, string stored)
        {
            if (string.IsNullOrEmpty(stored) || stored == AnonymousTaskName) return null;
            if (_crypto == null) return stored;
            var keys = new List<byte[]> { _crypto.GetKeyForUser(userId) };
            keys.AddRange(_crypto.GetLegacyKeysForUser(userId));
            foreach (var key in keys)
            {
                try
                {
                    var plain = _crypto.Decrypt(stored, key);
                    return plain == AnonymousTaskName ? null : plain;
                }
                catch (Exception e) when (e is System.Security.Cryptography.CryptographicException or FormatException or ArgumentException)
                {
                    // sıradaki anahtar
                }
            }
            return null;
        }

        public async Task<UserStats> GetUserStatsAsync(int userId)
        {
            var now = DateTime.UtcNow;
            var sevenDaysAgo = now.AddDays(-7).Date;

            /*
              SADECE KULLANILAN SÜTUNLAR ÇEKİLİR — eskiden TAM satırlar geliyordu.

              Burası `.ToListAsync()` ile görevlerin BÜTÜN sütunlarını çekiyordu, oysa
              aşağıdaki hesabın tamamı tek bir alana dayanıyor: `DueDate` (artı satır
              sayısı). Taşınan gereksiz yük küçük değildi — TaskItem satırı şifreli
              `Title`, 5000 karaktere kadar şifreli `Description`, `TagsJson` ve iki blind
              index taşıyor. Görev kotası kullanıcı başına 5000; yani çok görev tamamlamış
              bir kullanıcıda istatistik ekranının HER açılışı megabaytlarca veriyi
              veritabanından çekip ağdan geçiriyor, sonra hepsini atıyordu.

              Cezayı en çok en sadık kullanıcı ödüyordu: uygulamayı ne kadar çok
              kullanırsan istatistik ekranın o kadar yavaşlıyordu.

              Oturumlar için de aynısı: altı sütunluk satırdan yalnız ikisi kullanılıyor.
              Tablo dar olduğu için kazanç küçük ama sorgu artık ne istediğini söylüyor.

              Davranış birebir aynı: aynı satırlar, aynı sıra, aynı sayı.
            */
            // `Completed` filtresi YOK: erken bitirilen seansın dakikaları da odaktır
            // (ürün kararı 2026-10-29). İstemci bunları sayıyor, sunucu saymıyordu —
            // ana sayfa "5 dk" derken Haftalık ve Geri Bakış "0 dk" gösteriyordu.
            var sessions = await _db.FocusSessions
                .AsNoTracking()
                .Where(f => f.UserId == userId)
                .Select(f => new { f.StartedAt, f.DurationMinutes })
                .ToListAsync();

            // Yalnız DueDate: satır sayısı `Count` için, değer ise seri/haftalık kırılım için.
            var completedTaskDueDates = await _db.Tasks
                .AsNoTracking()
                .Where(t => t.UserId == userId && t.IsCompleted)
                .Select(t => t.DueDate)
                .ToListAsync();

            var totalMinutes = sessions.Sum(s => s.DurationMinutes);
            var totalFocusHours = Math.Round(totalMinutes / 60.0, 1);
            var completedTasksCount = completedTaskDueDates.Count;

            // Streak calculation in-memory
            var completedDates = completedTaskDueDates
                .Where(d => d.HasValue)
                .Select(d => d!.Value.Date)
                .Distinct()
                .OrderByDescending(d => d)
                .ToList();

            int streak = 0;
            var checkDate = now.Date;
            foreach (var date in completedDates)
            {
                if (date == checkDate || date == checkDate.AddDays(-1))
                {
                    // If it matches today or yesterday (to continue a streak started before today)
                    if (streak == 0 && date < checkDate.AddDays(-1)) break; 
                    
                    streak++;
                    checkDate = date.AddDays(-1);
                }
                else break;
            }

            // NOT: Bu kırılım UTC'ye göre; istemci artık kendi takvimine göre hesaplıyor
            // (bkz. GetSessionsAsync + features/report/weeklyReport.ts). Burası eski
            // ekranlar (profil, başarımlar, kokpit rozeti) için olduğu gibi duruyor.
            // Current week focus data (Monday to Sunday)
            var weeklyFocus = new List<DailyFocusData>();
            int diff = (7 + (now.DayOfWeek - DayOfWeek.Monday)) % 7;
            var monday = now.AddDays(-diff).Date;

            for (int i = 0; i < 7; i++)
            {
                var day = monday.AddDays(i).Date;
                var dayMinutes = sessions
                    .Where(s => s.StartedAt.Date == day)
                    .Sum(s => s.DurationMinutes);
                
                var dayTasksCompleted = completedTaskDueDates
                    .Count(d => d.HasValue && d.Value.Date == day);

                weeklyFocus.Add(new DailyFocusData
                {
                    Day = day.ToString("ddd"),
                    Minutes = dayMinutes,
                    TasksCompleted = dayTasksCompleted
                });
            }

            var lastWeekStart = monday.AddDays(-7).Date;
            var lastWeekMinutes = sessions
                .Where(s => s.StartedAt.Date >= lastWeekStart && s.StartedAt.Date < monday)
                .Sum(s => s.DurationMinutes);

            return new UserStats
            {
                TotalFocusHours = totalFocusHours,
                CompletedTasksCount = completedTasksCount,
                ActiveStreak = streak,
                WeeklyFocus = weeklyFocus,
                LastWeekFocusMinutes = lastWeekMinutes
            };
        }

        /// <inheritdoc />
        public async Task<List<FocusSessionRow>> GetSessionsAsync(int userId, int days)
        {
            // Sınır: istemci ne isterse istesin en çok 120 gün. Hem yükü hem de
            // "tüm geçmişi tek istekte çek" ihtimalini kapatır.
            var window = Math.Clamp(days, 1, 120);
            var since = DateTime.UtcNow.Date.AddDays(-window);

            var rows = await _db.FocusSessions
                .AsNoTracking()
                .Where(f => f.UserId == userId && f.StartedAt >= since) // erken bitenler dahil (bkz. GetUserStatsAsync)
                .OrderBy(f => f.StartedAt)
                .Select(f => new { f.Id, f.StartedAt, f.DurationMinutes, f.TaskName, f.Completed, f.PausedSeconds })
                .ToListAsync();
            return rows.Select(f => new FocusSessionRow
            {
                Id = f.Id,
                StartedAt = f.StartedAt,
                Minutes = f.DurationMinutes,
                TaskName = ReadName(userId, f.TaskName),
                Completed = f.Completed,
                PausedSeconds = f.PausedSeconds
            }).ToList();
        }
    }
}
