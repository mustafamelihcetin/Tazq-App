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
                // Toplam — her şeyi görmek isteyen için.
                warnings = _logStore.CountByLevel("Warning"),
                errors = _logStore.CountByLevel("Error") + _logStore.CountByLevel("Critical"),
                // YAYIN-ONLY sayaçlar: sağlık rozetinin geliştirme gürültüsüyle kızarmaması
                // için. Geliştirme sürümü de bu API'ye bağlanıyor; kod yazarken çıkan her
                // hata "canlı sistemde 14 hata var" gibi görünüyordu ve rozet anlamını
                // yitiriyordu — sürekli kırmızı olan bir gösterge okunmayı bırakır.
                warningsLive = _logStore.CountByLevel("Warning", LogSource.Production),
                errorsLive = _logStore.CountByLevel("Error", LogSource.Production)
                           + _logStore.CountByLevel("Critical", LogSource.Production),
                logSources = _logStore.CountBySource(),
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

        /// <summary>
        /// Sunucu logları — SAYFALANMIŞ ve KAYNAĞA GÖRE FİLTRELENEBİLİR.
        ///
        /// Eskiden `?lines=200` ile baştan N kayıt dönüyordu; gerisine ulaşmanın yolu
        /// yoktu. Tampon 500 kayıt tutuyor, panel 60'ını çiziyordu — kayıtların çoğu
        /// vardı ama görülemiyordu.
        ///
        /// `source`: geliştirme sürümü de production API'ye bağlandığı için geliştirme
        /// hataları canlı havuza karışıyordu. `source=Production` ile yalnız gerçek
        /// kullanıcı hataları görülebilir. Varsayılan filtresizdir — hiçbir şey
        /// gizlemiyoruz, ayırmayı istemciye bırakıyoruz.
        /// </summary>
        [HttpGet("logs")]
        public IActionResult Logs(
            [FromQuery] int limit = 50,
            [FromQuery] int offset = 0,
            [FromQuery] string? level = null,
            [FromQuery] string? source = null,
            [FromQuery] int? lines = null)
        {
            // `lines` eski istemciler için: yeni alan gelmezse onu limit say.
            var take = lines ?? limit;

            LogSource? src = null;
            if (!string.IsNullOrWhiteSpace(source) && Enum.TryParse<LogSource>(source, true, out var parsed))
                src = parsed;

            var page = _logStore.Page(take, offset, level, src);

            return Ok(new
            {
                logs = page.Items,
                total = page.Total,
                offset = page.Offset,
                limit = page.Limit,
                hasMore = page.Offset + page.Items.Count < page.Total,
                // Filtre düğmelerinin yanında sayı gösterebilmek için — kullanıcı
                // "geliştirmeyi gizlersem ne kalır?" sorusunu tıklamadan görsün.
                counts = _logStore.CountBySource(),
            });
        }

        /// <summary>
        /// YAPAY ZEKÂ DURUMU — anahtar, model ve gerçek bağlantı.
        ///
        /// Bu uç noktaya kadar AI tarafının çalışıp çalışmadığını anlamanın tek yolu
        /// sunucuya SSH ile girip `.env` okumak ya da uygulamada bir plan açıp logda
        /// hata var mı diye bakmaktı. İkisi de "önce kırılsın, sonra fark edeyim"
        /// yöntemi. Panelden görülebilir olması, sessizce ölmüş bir entegrasyonu
        /// kullanıcı şikâyet etmeden yakalamayı sağlar.
        ///
        /// ANAHTAR ASLA TAM DÖNMEZ — yalnız maskeli. Bir admin panelinden okunabilen
        /// sır, artık sır değildir: paneli açan herkes (omuz üstünden bakan dahil)
        /// onu ele geçirebilir. Doğrulamak için görmeye gerek yok; `test` uç noktası
        /// zaten canlı cevap veriyor.
        /// </summary>
        [HttpGet("ai")]
        public IActionResult AiStatus()
        {
            var key = Environment.GetEnvironmentVariable("GROQ_API_KEY");
            var model = Environment.GetEnvironmentVariable("GROQ_MODEL");
            var configured = !string.IsNullOrWhiteSpace(key);

            return Ok(new
            {
                configured,
                // Maskeli: doğru anahtarın yüklü olduğunu doğrulamaya yeter, ele
                // geçirmeye yetmez.
                keyMasked = configured && key!.Length > 8
                    ? $"{key[..4]}…{key[^4..]}"
                    : (configured ? "…" : null),
                keyLength = configured ? key!.Length : 0,
                model = string.IsNullOrWhiteSpace(model) ? "llama-3.3-70b-versatile (varsayılan)" : model.Trim(),
                modelFromEnv = !string.IsNullOrWhiteSpace(model),
            });
        }

        /// <summary>
        /// AI bağlantısını GERÇEKTEN dener — sağlayıcıya canlı istek atar.
        ///
        /// "Anahtar tanımlı" ile "anahtar çalışıyor" farklı şeyler: anahtar iptal
        /// edilmiş, kotası dolmuş ya da model listeden kalkmış olabilir. Üçü de
        /// yapılandırmaya bakarak anlaşılmaz. Bu yüzden burada tahmin yok, çağrı var.
        /// </summary>
        [HttpPost("ai/test")]
        public async Task<IActionResult> AiTest()
        {
            var key = Environment.GetEnvironmentVariable("GROQ_API_KEY");
            if (string.IsNullOrWhiteSpace(key))
                return Ok(new { ok = false, stage = "config", message = "GROQ_API_KEY tanımlı değil." });

            var model = Environment.GetEnvironmentVariable("GROQ_MODEL");
            model = string.IsNullOrWhiteSpace(model) ? "llama-3.3-70b-versatile" : model.Trim();

            try
            {
                var client = _httpFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(15);
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {key}");

                // 1) Anahtar geçerli mi + model hâlâ listede mi?
                var listResp = await client.GetAsync("https://api.groq.com/openai/v1/models");
                if (!listResp.IsSuccessStatusCode)
                    return Ok(new
                    {
                        ok = false,
                        stage = "auth",
                        status = (int)listResp.StatusCode,
                        message = listResp.StatusCode == System.Net.HttpStatusCode.Unauthorized
                            ? "Anahtar reddedildi (401) — iptal edilmiş veya yanlış."
                            : $"Sağlayıcı {(int)listResp.StatusCode} döndü.",
                    });

                var listJson = await listResp.Content.ReadAsStringAsync();
                var modelAvailable = listJson.Contains($"\"{model}\"", StringComparison.Ordinal);

                // 2) Model gerçekten üretiyor mu? Liste "var" dese bile üretim
                //    kotaya/erişime takılabilir; tek kesin kanıt bir yanıttır.
                var sw = Stopwatch.StartNew();
                var genResp = await client.PostAsync(
                    "https://api.groq.com/openai/v1/chat/completions",
                    new StringContent(
                        System.Text.Json.JsonSerializer.Serialize(new
                        {
                            model,
                            messages = new[] { new { role = "user", content = "Reply with exactly: OK" } },
                            max_tokens = 5,
                        }),
                        System.Text.Encoding.UTF8, "application/json"));
                sw.Stop();

                var ok = genResp.IsSuccessStatusCode;
                return Ok(new
                {
                    ok,
                    stage = ok ? "ready" : "generation",
                    status = (int)genResp.StatusCode,
                    model,
                    modelAvailable,
                    latencyMs = sw.ElapsedMilliseconds,
                    message = ok
                        ? "Bağlantı ve üretim çalışıyor."
                        : modelAvailable
                            ? $"Model listede ama üretim {(int)genResp.StatusCode} döndü (kota/erişim?)."
                            : $"'{model}' modeli sağlayıcı listesinde YOK — GROQ_MODEL güncellenmeli.",
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning("AI test failed: {Error}", ex.Message);
                return Ok(new { ok = false, stage = "network", message = ex.Message });
            }
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
