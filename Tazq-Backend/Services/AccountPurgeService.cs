using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;

namespace Tazq_App.Services
{
    // Grace süresi (UserService.AccountGracePeriod) dolmuş soft-deleted hesapları
    // kalıcı olarak temizler. Günde bir kez çalışır. BackgroundService singleton olduğundan
    // DbContext'i scope içinden çözer.
    public class AccountPurgeService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<AccountPurgeService> _logger;
        private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

        public AccountPurgeService(IServiceScopeFactory scopeFactory, ILogger<AccountPurgeService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Uygulama tam ayağa kalksın diye kısa başlangıç gecikmesi
            try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); } catch { }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                    var cutoff = DateTime.UtcNow - UserService.AccountGracePeriod;
                    var expired = await db.Users.IgnoreQueryFilters()
                        .Where(u => u.DeletedAt != null && u.DeletedAt < cutoff)
                        .ToListAsync(stoppingToken);

                    if (expired.Count > 0)
                    {
                        db.Users.RemoveRange(expired);
                        await db.SaveChangesAsync(stoppingToken);
                        _logger.LogInformation("AccountPurgeService: {Count} süresi dolmuş hesap kalıcı olarak silindi.", expired.Count);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "AccountPurgeService çalışırken hata oluştu.");
                }

                try { await Task.Delay(Interval, stoppingToken); } catch { }
            }
        }
    }
}
