using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    public class SystemServiceTests
    {
        private readonly AppDbContext _context;
        private readonly SystemService _service;

        public SystemServiceTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new AppDbContext(options);
            // Redis kayıtlı değil → GetRedis() null döner (yerel/InMemory kurulumu taklit eder).
            var services = new ServiceCollection().BuildServiceProvider();
            _service = new SystemService(_context, services, new Mock<ILogger<SystemService>>().Object);
        }

        [Fact]
        public async Task GetHealthAsync_ShouldReportRedisNull_WhenNotConfigured()
        {
            var health = await _service.GetHealthAsync();

            // Redis yoksa "bilinmiyor" (null) olmalı — "bozuk" (false) değil.
            Assert.Null(health.RedisOk);
        }

        [Fact]
        public async Task GetHealthAsync_ShouldNotThrow_WhenMigrationStateUnavailable()
        {
            // InMemory sağlayıcı migration sorgularını desteklemez. Sağlık kontrolünün işi
            // bozuk durumu raporlamaktır, fırlatmak değil — bu yüzden yutulur ama loglanır.
            var health = await _service.GetHealthAsync();

            Assert.Equal(0, health.PendingMigrations);
            Assert.Null(health.LatestMigration);
        }

        [Fact]
        public async Task GetStatsAsync_ShouldCountEachEntity()
        {
            _context.Users.Add(new User { Email = "a@test.com", Name = "A", Role = "User" });
            _context.Tasks.Add(new TaskItem { UserId = 1, Title = "t" });
            _context.FocusSessions.Add(new FocusSession { UserId = 1, TaskName = "f", DurationMinutes = 5 });
            _context.SupportMessages.Add(new SupportMessage { UserId = 1, Message = "m", IsRead = false });
            _context.SupportMessages.Add(new SupportMessage { UserId = 1, Message = "m2", IsRead = true });
            _context.ContentDocuments.Add(new ContentDocument { Key = "k", Json = "{}" });
            await _context.SaveChangesAsync();

            var stats = await _service.GetStatsAsync();

            Assert.Equal(1, stats.Users);
            Assert.Equal(1, stats.Tasks);
            Assert.Equal(1, stats.FocusSessions);
            Assert.Equal(2, stats.SupportMessages);
            Assert.Equal(1, stats.SupportUnread); // yalnız okunmamışlar
            Assert.Equal(1, stats.ContentDocuments);
        }

        [Fact]
        public async Task ClearCacheAsync_ShouldReturnFalse_WhenRedisNotConfigured()
        {
            Assert.False(await _service.ClearCacheAsync());
        }

        [Fact]
        public async Task WriteMaintenanceAuditAsync_ShouldUseProvidedAdminName()
        {
            await _service.WriteMaintenanceAuditAsync(new AdminIdentity(7, "Melih"), "Backend yeniden başlatıldı");

            var audit = await _context.AdminAuditLogs.SingleAsync();
            Assert.Equal("maintenance", audit.Action);
            Assert.Equal("system", audit.TargetType);
            Assert.Equal(7, audit.AdminId);
            Assert.Equal("Melih", audit.AdminName);
        }

        [Fact]
        public async Task WriteMaintenanceAuditAsync_ShouldFallBackToDbName_WhenTokenLacksName()
        {
            _context.Users.Add(new User { Id = 7, Email = "admin@test.com", Name = "DB Admin", Role = "Admin" });
            await _context.SaveChangesAsync();

            // Token'da ad claim'i yoksa denetim kaydı "kim" sorusunu yine de yanıtlamalı.
            await _service.WriteMaintenanceAuditAsync(new AdminIdentity(7, null), "Redis cache temizlendi");

            Assert.Equal("DB Admin", (await _context.AdminAuditLogs.SingleAsync()).AdminName);
        }
    }
}
