using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
    // Admin "Sistem" konsolu — SSH ihtiyacını azaltır. Yalnız Admin.
    // Gözlem (sağlık/log/istatistik/Sentry) + denetimli bakım (migrate/restart/cache).
    // Veri erişimi ve altyapı işleri ISystemService'te; burası ince HTTP katmanı.
    [Route("api/admin/system")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminSystemController : ControllerBase
    {
        private readonly ISystemService _system;
        private readonly InMemoryLogStore _logStore;
        private readonly IConfiguration _config;
        private readonly ILogger<AdminSystemController> _logger;
        private readonly IHttpClientFactory _httpFactory;

        public AdminSystemController(ISystemService system, InMemoryLogStore logStore, IConfiguration config, ILogger<AdminSystemController> logger, IHttpClientFactory httpFactory)
        {
            _system = system;
            _logStore = logStore;
            _config = config;
            _logger = logger;
            _httpFactory = httpFactory;
        }

        private AdminIdentity CurrentAdmin() => new(
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0"),
            User.FindFirst(ClaimTypes.Name)?.Value);

        // ── GÖZLEM ──────────────────────────────────────────────────────────────

        [HttpGet("health")]
        public async Task<IActionResult> Health()
        {
            var health = await _system.GetHealthAsync();

            var proc = Process.GetCurrentProcess();
            var uptime = DateTime.UtcNow - proc.StartTime.ToUniversalTime();

            return Ok(new
            {
                status = health.DbOk ? "ok" : "degraded",
                dbOk = health.DbOk,
                redisOk = health.RedisOk,
                environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production",
                serverTimeUtc = DateTime.UtcNow,
                uptimeSeconds = (long)uptime.TotalSeconds,
                latestMigration = health.LatestMigration,
                pendingMigrations = health.PendingMigrations,
                warnings = _logStore.CountByLevel("Warning"),
                errors = _logStore.CountByLevel("Error") + _logStore.CountByLevel("Critical"),
            });
        }

        [HttpGet("stats")]
        public async Task<IActionResult> Stats()
        {
            var s = await _system.GetStatsAsync();
            return Ok(new
            {
                users = s.Users,
                tasks = s.Tasks,
                focusSessions = s.FocusSessions,
                supportMessages = s.SupportMessages,
                supportUnread = s.SupportUnread,
                contentDocuments = s.ContentDocuments,
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

        [HttpPost("migrate")]
        public async Task<IActionResult> Migrate()
        {
            var result = await _system.ApplyPendingMigrationsAsync();
            if (!result.Success)
                return StatusCode(500, new { success = false, error = result.Error });

            if (result.Applied.Count == 0)
                return Ok(new { success = true, applied = Array.Empty<string>(), message = "Bekleyen migration yok." });

            await _system.WriteMaintenanceAuditAsync(CurrentAdmin(), $"Migration uygulandı: {string.Join(", ", result.Applied)}");
            return Ok(new { success = true, applied = result.Applied });
        }

        [HttpPost("clear-cache")]
        public async Task<IActionResult> ClearCache()
        {
            try
            {
                if (!await _system.ClearCacheAsync())
                    return Ok(new { success = false, message = "Redis bağlı değil (yerel/InMemory)." });

                await _system.WriteMaintenanceAuditAsync(CurrentAdmin(), "Redis cache temizlendi");
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Admin clear-cache failed.");
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        [HttpPost("restart")]
        public async Task<IActionResult> Restart()
        {
            // compose 'restart: unless-stopped' → temiz çıkış sonrası container otomatik kalkar.
            // Yanıtı döndürdükten ~1 sn sonra süreci sonlandır (kısa kesinti).
            _logger.LogWarning("Admin requested backend restart.");
            await _system.WriteMaintenanceAuditAsync(CurrentAdmin(), "Backend yeniden başlatıldı");
            // Kasıtlı fire-and-forget: yanıtın istemciye ulaşması için kısa bir gecikmeden
            // sonra süreç kapanır (container/systemd yeniden başlatır). Scoped servis
            // yakalamadığı için arka plan kuyruğuna taşınması gerekmez.
            _ = Task.Run(async () => { await Task.Delay(1000); Environment.Exit(0); });
            return Ok(new { success = true, message = "Yeniden başlatılıyor… (birkaç saniye)" });
        }
    }
}
