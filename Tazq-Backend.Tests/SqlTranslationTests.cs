using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;
using Xunit;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// InMemory sağlayıcı LINQ'i istemcide çalıştırır; Npgsql'in SQL'e ÇEVİREMEDİĞİ sorgular
    /// orada sessizce geçer ve canlıda 500 olur. Burada sorgu, gerçek Npgsql sağlayıcısıyla
    /// yalnız SQL'e çevrilir (ToQueryString) — bağlantı açılmaz, veritabanı gerekmez.
    /// 2026-10-30: /api/admin/product-insights sürüm dağılımı yüzünden canlıda 500 veriyordu.
    /// </summary>
    public class SqlTranslationTests
    {
        private static AppDbContext Npgsql() => new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=translate_only").Options);

        [Fact]
        public void VersionShareQuery_TranslatesToSql()
        {
            using var db = Npgsql();
            var sql = AdminService.VersionShareQuery(db.Users).ToQueryString();
            Assert.Contains("GROUP BY", sql);
            Assert.Contains("ORDER BY", sql);
        }

        [Fact]
        public void AnalyticsTaskSignals_TranslatesToSql()
        {
            using var db = Npgsql();
            var sql = AnalyticsService.TaskSignalsQuery(db.Tasks).ToQueryString();
            Assert.Contains("GROUP BY", sql);
        }

        [Fact]
        public void AnalyticsAudience_TranslatesToSql()
        {
            using var db = Npgsql();
            var ids = AdminService.Audience(db.Users).Select(u => u.Id);
            Assert.Contains("WHERE", db.FocusSessions.Where(f => ids.Contains(f.UserId)).ToQueryString());
        }

        [Fact]
        public void CrashGroups_TranslateToSql()
        {
            using var db = Npgsql();
            foreach (var open in new[] { true, false })
                Assert.Contains("GROUP BY", CrashLog.GroupQuery(db.ClientCrashes, open).ToQueryString());
        }

        [Fact]
        public void SupportInbox_OrderByLastActivity_TranslatesToSql()
        {
            using var db = Npgsql();
            var sql = db.SupportMessages.Include(m => m.Replies).OrderByDescending(m => m.LastActivityAt ?? m.CreatedAt).ToQueryString();
            Assert.Contains("COALESCE", sql);
        }

        [Fact]
        public void UserFilters_TranslateToSql()
        {
            using var db = Npgsql();
            foreach (var f in AdminService.UserFilters)
                Assert.Contains("WHERE", AdminService.ApplyUserFilter(db.Users, f, DateTime.UtcNow).ToQueryString());
        }

        [Fact]
        public void OldVersionShareShape_DoesNotTranslate()
        {
            // Bekçinin gerçekten yakaladığının kanıtı: eski biçim çevrilemez.
            using var db = Npgsql();
            var old = db.Users.Where(u => u.LastKnownAppVersion != null)
                .GroupBy(u => u.LastKnownAppVersion)
                .Select(g => new VersionShare(g.Key!, g.Count()))
                .OrderByDescending(v => v.Users);
            Assert.Throws<InvalidOperationException>(() => old.ToQueryString());
        }
    }
}
