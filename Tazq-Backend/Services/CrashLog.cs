using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    /*
      ÇÖKME KAYITLARI — GRUPLAMA + SAKLAMA (2026-10-31, kullanıcı: "crash log listesi çok uzun; belirli
      tarihten eskiler artık saklanmamalı, bunu da iyi düşün").

      ÖLÇÜM (canlı, 2026-10-31): 79 kayıt, yalnız 42 farklı hata — "GlassSurface" tek başına 10 kez.
      Düz liste aynı hatayı tekrar tekrar gösteriyordu. Artık HATA BAŞINA TEK satır (parmak izi =
      hata mesajı): kaç kez, ilk/son ne zaman, hangi sürüm/platform; "çözüldü" bütün grubu kapatır.

      SAKLAMA — neden bu süreler:
        · Kayıt kişisel veri taşır (e-posta, cihaz adı, yığın izi). KVKK/GDPR veri minimizasyonu:
          amaç (hatayı düzeltmek) bitince saklamaya gerekçe yok.
        · Çözülmüş: 30 gün — düzeltme yayına çıkıp aynı hata geri gelirse (gerileme) görülsün diye pay.
        · Hiçbir kayıt 90 günden uzun değil — o kadar eski sürümün hatası bugün yol göstermez;
          gerçekten süren hata yeni kayıt üretmeye devam eder (grup yaşar, eski kopyalar gider).
      Günlük iş (CrashRetentionService), durumu admin → Sistem → Arka plan işleri'nde.
    */
    public static class CrashLog
    {
        public static readonly TimeSpan ResolvedRetention = TimeSpan.FromDays(30);
        public static readonly TimeSpan MaxRetention = TimeSpan.FromDays(90);

        public sealed record Group(
            string ErrorMessage, int Count, int Unresolved, DateTime FirstAt, DateTime LastAt, int LatestId);

        /// <summary>Hata başına özet; en son görülen önde. (Anonim tipte sırala, sonra kur — Npgsql çevirisi.)</summary>
        public static IQueryable<Group> GroupQuery(IQueryable<ClientCrash> crashes, bool unresolvedOnly)
        {
            var q = crashes.GroupBy(c => c.ErrorMessage).Select(g => new
            {
                g.Key,
                Count = g.Count(),
                Unresolved = g.Count(c => !c.IsResolved),
                FirstAt = g.Min(c => c.CreatedAt),
                LastAt = g.Max(c => c.CreatedAt),
                LatestId = g.Max(c => c.Id),
            });
            if (unresolvedOnly) q = q.Where(x => x.Unresolved > 0);
            return q.OrderByDescending(x => x.LastAt).ThenByDescending(x => x.LatestId)
                .Select(x => new Group(x.Key, x.Count, x.Unresolved, x.FirstAt, x.LastAt, x.LatestId));
        }

        public static async Task<(List<Group> Groups, int Total, List<ClientCrash> Latest)> GroupsPageAsync(
            AppDbContext db, int limit, int offset, bool unresolvedOnly)
        {
            var q = GroupQuery(db.ClientCrashes.AsNoTracking(), unresolvedOnly);
            var total = await q.CountAsync();
            var groups = await q.Skip(Math.Max(offset, 0)).Take(Math.Clamp(limit, 1, 100)).ToListAsync();
            var ids = groups.Select(g => g.LatestId).ToList();
            var latest = await db.ClientCrashes.AsNoTracking().Where(c => ids.Contains(c.Id)).ToListAsync();
            return (groups, total, latest);
        }

        /// <summary>Gruptaki (aynı hata mesajı) tüm kayıtları çözüldü işaretler.</summary>
        public static async Task<int> ResolveGroupAsync(AppDbContext db, string errorMessage)
        {
            var rows = await db.ClientCrashes.Where(c => c.ErrorMessage == errorMessage && !c.IsResolved).ToListAsync();
            rows.ForEach(c => c.IsResolved = true);
            await db.SaveChangesAsync();
            return rows.Count;
        }

        /// <summary>Saklama süresi dolanları siler; silinen sayıyı döner.</summary>
        public static async Task<int> PurgeAsync(AppDbContext db, DateTime now, CancellationToken ct = default)
        {
            var resolvedCutoff = now - ResolvedRetention;
            var hardCutoff = now - MaxRetention;
            var old = await db.ClientCrashes
                .Where(c => c.CreatedAt < hardCutoff || (c.IsResolved && c.CreatedAt < resolvedCutoff))
                .ToListAsync(ct);
            if (old.Count == 0) return 0;
            db.ClientCrashes.RemoveRange(old);
            await db.SaveChangesAsync(ct);
            return old.Count;
        }
    }

    /// <summary>Günlük çökme kaydı temizliği (bkz. CrashLog).</summary>
    public class CrashRetentionService : BackgroundService
    {
        private static readonly TimeSpan Interval = TimeSpan.FromHours(24);
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<CrashRetentionService> _logger;
        private readonly JobHealth _health;

        public CrashRetentionService(IServiceScopeFactory scopeFactory, ILogger<CrashRetentionService> logger, JobHealth health)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
            _health = health;
            _health.Register(JobHealth.CrashRetention, Interval);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); } catch { }
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var n = await CrashLog.PurgeAsync(db, DateTime.UtcNow, stoppingToken);
                    if (n > 0) _logger.LogInformation("CrashRetention: {Count} eski çökme kaydı silindi.", n);
                    _health.Ok(JobHealth.CrashRetention);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "CrashRetention çalışırken hata oluştu.");
                    _health.Fail(JobHealth.CrashRetention, ex);
                }
                try { await Task.Delay(Interval, stoppingToken); } catch { }
            }
        }
    }
}
