using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using System.Security.Claims;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
    // Admin "Sistem" konsolu — SSH ihtiyacını azaltır. Yalnız Admin.
    // Gözlem (sağlık/log/istatistik/Sentry) + denetimli bakım (migrate/restart/cache).
    [Route("api/admin/system")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminSystemController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly InMemoryLogStore _logStore;
        private readonly IServiceProvider _sp;
        private readonly IConfiguration _config;
        private readonly ILogger<AdminSystemController> _logger;
        private readonly IHttpClientFactory _httpFactory;

        public AdminSystemController(AppDbContext db, InMemoryLogStore logStore, IServiceProvider sp, IConfiguration config, ILogger<AdminSystemController> logger, IHttpClientFactory httpFactory)
        {
            _db = db;
            _logStore = logStore;
            _sp = sp;
            _config = config;
            _logger = logger;
            _httpFactory = httpFactory;
        }

        // ── GÖZLEM ──────────────────────────────────────────────────────────────

        [HttpGet("health")]
        public async Task<IActionResult> Health()
        {
            bool dbOk;
            try { dbOk = await _db.Database.CanConnectAsync(); } catch { dbOk = false; }

            bool? redisOk = null;
            try
            {
                var mux = _sp.GetService(typeof(IConnectionMultiplexer)) as IConnectionMultiplexer;
                if (mux != null)
                {
                    var db = mux.GetDatabase();
                    redisOk = (await db.PingAsync()).TotalMilliseconds >= 0;
                }
            }
            catch { redisOk = false; }

            string? latestMigration = null;
            int pendingCount = 0;
            try
            {
                latestMigration = (await _db.Database.GetAppliedMigrationsAsync()).LastOrDefault();
                pendingCount = (await _db.Database.GetPendingMigrationsAsync()).Count();
            }
            catch { }

            var proc = Process.GetCurrentProcess();
            var uptime = DateTime.UtcNow - proc.StartTime.ToUniversalTime();

            return Ok(new
            {
                status = dbOk ? "ok" : "degraded",
                dbOk,
                redisOk,
                environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production",
                serverTimeUtc = DateTime.UtcNow,
                uptimeSeconds = (long)uptime.TotalSeconds,
                latestMigration,
                pendingMigrations = pendingCount,
                warnings = _logStore.CountByLevel("Warning"),
                errors = _logStore.CountByLevel("Error") + _logStore.CountByLevel("Critical"),
            });
        }

        [HttpGet("stats")]
        public async Task<IActionResult> Stats()
        {
            return Ok(new
            {
                users = await _db.Users.CountAsync(),
                tasks = await _db.Tasks.CountAsync(),
                focusSessions = await _db.FocusSessions.CountAsync(),
                supportMessages = await _db.SupportMessages.CountAsync(),
                supportUnread = await _db.SupportMessages.CountAsync(m => !m.IsRead),
                contentDocuments = await _db.ContentDocuments.CountAsync(),
            });
        }

        [HttpGet("logs")]
        public IActionResult Logs([FromQuery] int lines = 200, [FromQuery] string? level = null)
        {
            return Ok(new { logs = _logStore.Recent(lines, level) });
        }

        [HttpGet("sentry")]
        public async Task<IActionResult> Sentry()
        {
            var token = _config["SENTRY_AUTH_TOKEN"] ?? Environment.GetEnvironmentVariable("SENTRY_AUTH_TOKEN");
            var org = _config["SENTRY_ORG"] ?? Environment.GetEnvironmentVariable("SENTRY_ORG");
            var project = _config["SENTRY_PROJECT"] ?? Environment.GetEnvironmentVariable("SENTRY_PROJECT");

            if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(org) || string.IsNullOrWhiteSpace(project))
                return Ok(new { configured = false, message = "SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT .env'de tanımlı değil." });

            try
            {
                // Bölge desteği: EU org'ları https://eu.sentry.io kullanmalı. Varsayılan global.
                var baseUrl = (_config["SENTRY_BASE_URL"] ?? Environment.GetEnvironmentVariable("SENTRY_BASE_URL") ?? "https://sentry.io").TrimEnd('/');
                var client = _httpFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(10);
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
                // Son 24 saatteki çözülmemiş ilk konular.
                var url = $"{baseUrl}/api/0/projects/{org}/{project}/issues/?query=is:unresolved&statsPeriod=24h&limit=10";
                var resp = await client.GetAsync(url);
                if (!resp.IsSuccessStatusCode)
                    return Ok(new { configured = true, ok = false, status = (int)resp.StatusCode });

                var json = await resp.Content.ReadAsStringAsync();
                using var doc = System.Text.Json.JsonDocument.Parse(json);
                var issues = doc.RootElement.EnumerateArray().Select(e => new
                {
                    title = e.GetProperty("title").GetString(),
                    count = e.TryGetProperty("count", out var c) ? c.GetString() : null,
                    level = e.TryGetProperty("level", out var l) ? l.GetString() : null,
                    lastSeen = e.TryGetProperty("lastSeen", out var ls) ? ls.GetString() : null,
                    permalink = e.TryGetProperty("permalink", out var p) ? p.GetString() : null,
                }).ToList();

                return Ok(new { configured = true, ok = true, count = issues.Count, issues, dashboard = $"https://{org}.sentry.io/projects/{project}/" });
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Sentry summary failed: {Error}", ex.Message);
                return Ok(new { configured = true, ok = false, error = ex.Message });
            }
        }

        // ── DENETİMLİ BAKIM ────────────────────────────────────────────────────

        private async Task WriteAuditAsync(string details)
        {
            var requesterId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var adminName = User.FindFirst(ClaimTypes.Name)?.Value
                ?? await _db.Users.IgnoreQueryFilters().Where(u => u.Id == requesterId).Select(u => u.Name).FirstOrDefaultAsync();
            _db.AdminAuditLogs.Add(new AdminAuditLog { AdminId = requesterId, AdminName = adminName, Action = "maintenance", TargetType = "system", Details = details, CreatedAt = DateTime.UtcNow });
            await _db.SaveChangesAsync();
        }

        [HttpPost("migrate")]
        public async Task<IActionResult> Migrate()
        {
            try
            {
                var pending = (await _db.Database.GetPendingMigrationsAsync()).ToList();
                if (pending.Count == 0) return Ok(new { success = true, applied = Array.Empty<string>(), message = "Bekleyen migration yok." });
                await _db.Database.MigrateAsync();
                _logger.LogWarning("Admin applied migrations: {Migrations}", string.Join(", ", pending));
                await WriteAuditAsync($"Migration uygulandı: {string.Join(", ", pending)}");
                return Ok(new { success = true, applied = pending });
            }
            catch (Exception ex)
            {
                _logger.LogError("Admin migrate failed: {Error}", ex.Message);
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        [HttpPost("clear-cache")]
        public async Task<IActionResult> ClearCache()
        {
            var mux = _sp.GetService(typeof(IConnectionMultiplexer)) as IConnectionMultiplexer;
            if (mux == null) return Ok(new { success = false, message = "Redis bağlı değil (yerel/InMemory)." });
            try
            {
                foreach (var ep in mux.GetEndPoints())
                {
                    var server = mux.GetServer(ep);
                    if (!server.IsReplica) await server.FlushDatabaseAsync();
                }
                _logger.LogWarning("Admin cleared Redis cache.");
                await WriteAuditAsync("Redis cache temizlendi");
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        [HttpPost("restart")]
        public async Task<IActionResult> Restart()
        {
            // compose 'restart: unless-stopped' → temiz çıkış sonrası container otomatik kalkar.
            // Yanıtı döndürdükten ~1 sn sonra süreci sonlandır (kısa kesinti).
            _logger.LogWarning("Admin requested backend restart.");
            await WriteAuditAsync("Backend yeniden başlatıldı");
            _ = Task.Run(async () => { await Task.Delay(1000); Environment.Exit(0); });
            return Ok(new { success = true, message = "Yeniden başlatılıyor… (birkaç saniye)" });
        }
    }
}
