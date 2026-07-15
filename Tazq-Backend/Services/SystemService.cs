using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    public class SystemService : ISystemService
    {
        private readonly AppDbContext _context;
        private readonly IServiceProvider _services;
        private readonly ILogger<SystemService> _logger;

        public SystemService(AppDbContext context, IServiceProvider services, ILogger<SystemService> logger)
        {
            _context = context;
            _services = services;
            _logger = logger;
        }

        private IConnectionMultiplexer? GetRedis()
            => _services.GetService(typeof(IConnectionMultiplexer)) as IConnectionMultiplexer;

        public async Task<SystemHealth> GetHealthAsync()
        {
            // Sağlık kontrolü hiçbir koşulda fırlatmamalı: amacı "bozuk" durumu raporlamak,
            // bozuk durumda 500 vermek değil. Bu yüzden her sonda ayrı ayrı yakalanır —
            // ancak sessizce değil, sebep loglanır (eskiden `catch { }` ile yutuluyordu).
            bool dbOk;
            try
            {
                dbOk = await _context.Database.CanConnectAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Health check: database connection failed.");
                dbOk = false;
            }

            bool? redisOk = null;
            try
            {
                var mux = GetRedis();
                if (mux != null)
                {
                    var db = mux.GetDatabase();
                    redisOk = (await db.PingAsync()).TotalMilliseconds >= 0;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Health check: Redis ping failed.");
                redisOk = false;
            }

            string? latestMigration = null;
            int pendingCount = 0;
            try
            {
                latestMigration = (await _context.Database.GetAppliedMigrationsAsync()).LastOrDefault();
                pendingCount = (await _context.Database.GetPendingMigrationsAsync()).Count();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Health check: could not read migration state.");
            }

            return new SystemHealth(dbOk, redisOk, latestMigration, pendingCount);
        }

        public async Task<SystemStats> GetStatsAsync()
            => new(
                await _context.Users.CountAsync(),
                await _context.Tasks.CountAsync(),
                await _context.FocusSessions.CountAsync(),
                await _context.SupportMessages.CountAsync(),
                await _context.SupportMessages.CountAsync(m => !m.IsRead),
                await _context.ContentDocuments.CountAsync());

        public async Task<MigrateResult> ApplyPendingMigrationsAsync()
        {
            try
            {
                var pending = (await _context.Database.GetPendingMigrationsAsync()).ToList();
                if (pending.Count == 0) return new MigrateResult(true, new List<string>(), null);

                await _context.Database.MigrateAsync();
                _logger.LogWarning("Admin applied migrations: {Migrations}", string.Join(", ", pending));
                return new MigrateResult(true, pending, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin migrate failed.");
                return new MigrateResult(false, new List<string>(), ex.Message);
            }
        }

        public async Task<bool> ClearCacheAsync()
        {
            var mux = GetRedis();
            if (mux == null) return false;

            foreach (var ep in mux.GetEndPoints())
            {
                var server = mux.GetServer(ep);
                if (!server.IsReplica) await server.FlushDatabaseAsync();
            }
            _logger.LogWarning("Admin cleared Redis cache.");
            return true;
        }

        public async Task WriteMaintenanceAuditAsync(AdminIdentity admin, string details)
        {
            // Admin adı token'da yoksa DB'den tamamla — denetim kaydı kim olduğunu göstermeli.
            var adminName = admin.AdminName
                ?? await _context.Users.IgnoreQueryFilters()
                    .Where(u => u.Id == admin.AdminId)
                    .Select(u => u.Name)
                    .FirstOrDefaultAsync();

            _context.AdminAuditLogs.Add(new AdminAuditLog
            {
                AdminId = admin.AdminId,
                AdminName = adminName,
                Action = "maintenance",
                TargetType = "system",
                Details = details,
                CreatedAt = DateTime.UtcNow,
            });
            await _context.SaveChangesAsync();
        }
    }
}
