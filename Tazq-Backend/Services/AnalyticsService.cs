using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    /// <summary>
    /// ANALİZ MERKEZİ (madde 9, 2026-10-30) — Ürün Analisti rolünün ekranı. Kullanıcı:
    /// "arkadaşım userları neden görmüyorum diyebilir; user odaklı değil SİSTEM ANALİZ odaklı,
    /// analist isminden öte bir şey olmalı". Bu yüzden kişi listesi yerine DAVRANIŞ:
    /// segmentler, etkinleşme hunisi, özellik benimseme, odak davranışı, kararlılık.
    ///
    /// Gizlilik sınırı: yanıtta kişiyi tanıtan HİÇBİR alan yok (yalnız sayılar/oranlar).
    /// Şifreli içerik (görev başlığı, alt görev, etiket) okunmaz; tek istisna alışkanlık sayısı —
    /// kullanıcının kendi anahtarıyla çözülüp yalnız "en az bir alışkanlığı var mı" bilgisi alınır.
    /// Saatler Türkiye saati (UTC+3, 2016'dan beri yaz saati yok).
    /// </summary>
    public class AnalyticsService : IAnalyticsService
    {
        private const int TrHours = 3;
        private readonly AppDbContext _db;
        private readonly IHabitSyncService _habits;

        public AnalyticsService(AppDbContext db, IHabitSyncService habits)
        {
            _db = db;
            _habits = habits;
        }

        public async Task<AnalyticsReport> GetReportAsync(DateTime? nowUtc = null)
        {
            var now = nowUtc ?? DateTime.UtcNow;
            // Yalnız analiz kitlesi: ekip ve test hesapları hariç (bkz. AdminService.Audience).
            var users = await AdminService.Audience(_db.Users.AsNoTracking())
                .Select(u => new { u.Id, u.CreatedAt, u.LastActiveAt, u.IsEmailVerified, u.Preferences, HasHabitBlob = u.HabitsData != null })
                .ToListAsync();
            var ids = users.Select(u => u.Id).ToHashSet();

            // ── Segmentler (birbirini dışlar) ──
            int today = 0, week = 0, month = 0, dormant = 0, oneDay = 0, fresh = 0;
            foreach (var u in users)
            {
                var seen = u.LastActiveAt ?? u.CreatedAt;
                var neverBack = seen < u.CreatedAt.AddDays(1);
                if (neverBack && u.CreatedAt < now.AddDays(-7)) oneDay++;               // ilk günden sonra dönmedi
                else if (u.CreatedAt >= now.AddDays(-7) && neverBack) fresh++;         // yeni, henüz karar verilemez
                else if (seen >= now.Date) today++;
                else if (seen >= now.AddDays(-7)) week++;
                else if (seen >= now.AddDays(-30)) month++;
                else dormant++;
            }
            var monthlyActive = users.Count(u => (u.LastActiveAt ?? u.CreatedAt) >= now.AddDays(-30));
            var dailyActive = users.Count(u => (u.LastActiveAt ?? u.CreatedAt) >= now.Date);
            var segments = new AnalyticsSegments(users.Count, today, week, month, dormant, oneDay, fresh,
                monthlyActive > 0 ? Math.Round(100.0 * dailyActive / monthlyActive) : 0);

            // ── Kullanım sinyalleri (yalnız düz alanlar) ──
            var taskStats = await TaskSignalsQuery(_db.Tasks.AsNoTracking()).ToListAsync();
            taskStats = taskStats.Where(t => ids.Contains(t.UserId)).ToList();
            // Odak = süresi olan HER seans (yarım kalan da; bkz. haftalık geri bakış kararı). Tamamlanma ayrı ölçülür.
            var focusUsers = (await _db.FocusSessions.AsNoTracking().Where(f => f.DurationMinutes > 0).Select(f => f.UserId).Distinct().ToListAsync())
                .Where(ids.Contains).ToHashSet();
            var payUsers = (await _db.Payments.AsNoTracking().Select(p => p.UserId).Distinct().ToListAsync()).Where(ids.Contains).Count();
            var modeUsers = users.Count(u => u.Preferences != null && AdminService.UsesAnyMode(u.Preferences));
            var habitUsers = 0;
            foreach (var u in users.Where(u => u.HasHabitBlob))
            {
                var snap = await _habits.GetAsync(u.Id);
                if (HasAnyHabit(snap?.Data)) habitUsers++;
            }

            // ── Etkinleşme hunisi ──
            var eligible7 = users.Where(u => u.CreatedAt <= now.AddDays(-7)).ToList();
            var funnel = new List<FunnelStep>
            {
                new("registered", users.Count, users.Count),
                new("verified", users.Count(u => u.IsEmailVerified), users.Count),
                new("firstTask", taskStats.Count, users.Count),
                new("firstDone", taskStats.Count(t => t.Completed > 0), users.Count),
                new("firstFocus", focusUsers.Count, users.Count),
                new("day7", eligible7.Count(u => u.LastActiveAt.HasValue && u.LastActiveAt.Value >= u.CreatedAt.AddDays(7)), eligible7.Count),
            };

            // ── Özellik benimseme (kayıtlı kullanıcıların kaçı) ──
            var adoption = new List<FeatureAdoption>
            {
                new("tasks", taskStats.Count),
                new("focus", focusUsers.Count),
                new("habits", habitUsers),
                new("modes", modeUsers),
                new("payments", payUsers),
                new("dueDates", taskStats.Count(t => t.Dated > 0)),
                new("recurring", taskStats.Count(t => t.Recurring > 0)),
                new("priority", taskStats.Count(t => t.High > 0)),
            }.OrderByDescending(a => a.Users).ToList();

            // ── Odak davranışı (son 30 gün) ──
            var since = now.Date.AddDays(-29);
            var sessions = await _db.FocusSessions.AsNoTracking()
                .Where(f => f.StartedAt >= since)
                .Select(f => new { f.UserId, f.StartedAt, f.DurationMinutes, f.Completed })
                .ToListAsync();
            sessions = sessions.Where(s => ids.Contains(s.UserId)).ToList();
            var timed = sessions.Where(s => s.DurationMinutes > 0).ToList(); // yarım kalan seansın süresi de odaktır
            var minutes = timed.Select(s => s.DurationMinutes).OrderBy(m => m).ToList();
            var hours = new int[24];
            var weekdays = new int[7]; // 0 = Pazartesi
            var heat = new int[7 * 24]; // [gün * 24 + saat] — gün 0 = Pazartesi
            foreach (var s in timed)
            {
                var local = s.StartedAt.AddHours(TrHours);
                hours[local.Hour] += s.DurationMinutes;
                var wd = ((int)local.DayOfWeek + 6) % 7;
                weekdays[wd] += s.DurationMinutes;
                heat[wd * 24 + local.Hour] += s.DurationMinutes;
            }
            var daily = Enumerable.Range(0, 30).Select(i =>
            {
                var day = since.AddDays(i);
                return new DayMinutes(day.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
                    timed.Where(s => s.StartedAt.Date == day).Sum(s => s.DurationMinutes));
            }).ToList();
            var focus = new FocusBehavior(
                sessions.Count, sessions.Count(s => s.Completed),
                minutes.Count > 0 ? (int)Math.Round(minutes.Average()) : 0,
                minutes.Count > 0 ? minutes[minutes.Count / 2] : 0,
                new[] { minutes.Count(m => m < 10), minutes.Count(m => m >= 10 && m < 25), minutes.Count(m => m >= 25 && m < 50), minutes.Count(m => m >= 50) },
                hours, weekdays, daily, heat);

            // ── Kararlılık (son 7 gün; toplu — mesaj/yığın izi yok) ──
            var crashes = await _db.ClientCrashes.AsNoTracking()
                .Where(c => c.CreatedAt >= now.AddDays(-7))
                .Select(c => new { c.UserId, c.AppVersion })
                .ToListAsync();
            // Hesaplı çökmelerden yalnız kitleninki; hesapsız (misafir) çökmeler kalır — kime ait bilinmez.
            crashes = crashes.Where(c => c.UserId == null || ids.Contains(c.UserId.Value)).ToList();
            var affected = crashes.Where(c => c.UserId != null).Select(c => c.UserId).Distinct().Count();
            var weekActive = users.Count(u => (u.LastActiveAt ?? u.CreatedAt) >= now.AddDays(-7));
            var stability = new Stability(crashes.Count, affected,
                weekActive > 0 ? Math.Max(0, Math.Round(100.0 * (weekActive - affected) / weekActive)) : (double?)null,
                crashes.GroupBy(c => string.IsNullOrWhiteSpace(c.AppVersion) ? "?" : c.AppVersion)
                    .Select(g => new VersionCount(g.Key, g.Count())).OrderByDescending(v => v.Count).Take(3).ToList());

            var platforms = await _db.AppInstalls.AsNoTracking()
                .GroupBy(i => i.Platform)
                .Select(g => new PlatformCount(g.Key, g.Count()))
                .ToListAsync();

            return new AnalyticsReport(now, segments, funnel, adoption, focus, stability, platforms.OrderByDescending(p => p.Installs).ToList());
        }

        /// <summary>Kullanıcı başına görev sinyalleri — yalnız düz (şifresiz) alanlar. Npgsql'e çevrilebilir (bkz. SqlTranslationTests).</summary>
        public static IQueryable<UserTaskSignals> TaskSignalsQuery(IQueryable<TaskItem> tasks) => tasks
            .GroupBy(t => t.UserId)
            .Select(g => new UserTaskSignals(
                g.Key,
                g.Count(t => t.IsCompleted),
                g.Count(t => t.Recurrence != RecurrenceType.None),
                g.Count(t => t.DueDate != null),
                g.Count(t => t.Priority == TaskPriority.High)));

        /// <summary>Alışkanlık JSON'u en az bir öğe içeriyor mu (içerik dışarı çıkmaz).</summary>
        public static bool HasAnyHabit(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return false;
            try
            {
                using var doc = JsonDocument.Parse(json);
                return doc.RootElement.ValueKind == JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0;
            }
            catch (JsonException) { return false; }
        }
    }

    public interface IAnalyticsService
    {
        Task<AnalyticsReport> GetReportAsync(DateTime? nowUtc = null);
    }

    public record UserTaskSignals(int UserId, int Completed, int Recurring, int Dated, int High);
    public record AnalyticsSegments(int Total, int ActiveToday, int ActiveWeek, int ActiveMonth, int Dormant, int OneDayOnly, int New, double StickinessPct);
    public record FunnelStep(string Key, int Users, int Base);
    public record FeatureAdoption(string Key, int Users);
    public record DayMinutes(string Date, int Minutes);
    public record FocusBehavior(int Sessions30d, int Completed30d, int AvgMinutes, int MedianMinutes, int[] LengthBuckets, int[] HourMinutes, int[] WeekdayMinutes, List<DayMinutes> Daily, int[] Heat);
    public record VersionCount(string Version, int Count);
    public record Stability(int Crashes7d, int AffectedUsers7d, double? CrashFreePct, List<VersionCount> TopVersions);
    public record PlatformCount(string Platform, int Installs);
    public record AnalyticsReport(DateTime GeneratedAt, AnalyticsSegments Segments, List<FunnelStep> Funnel, List<FeatureAdoption> Adoption,
        FocusBehavior Focus, Stability Stability, List<PlatformCount> Platforms);
}
