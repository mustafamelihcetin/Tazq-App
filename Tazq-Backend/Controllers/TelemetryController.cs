using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Controllers
{
    [Route("api/telemetry")]
    [ApiController]
    public class TelemetryController : ControllerBase
    {
        private static readonly string[] AllowedPlatforms = { "ios", "android" };

        private readonly AppDbContext _context;

        public TelemetryController(AppDbContext context)
        {
            _context = context;
        }

        public record InstallPingRequest(string InstallId, string Platform);

        // Kayıtsız (misafir) cihazların anonim sayımı. Yalnız rastgele bir UUID ve platform
        // alır; kişisel veri yok. Kimlik doğrulaması istemez — misafir kullanıcının token'ı yok.
        [AllowAnonymous]
        [HttpPost("install")]
        public async Task<IActionResult> InstallPing([FromBody] InstallPingRequest request)
        {
            if (!Guid.TryParse(request.InstallId, out var installId)) return BadRequest();
            var platform = request.Platform?.ToLowerInvariant();
            if (platform is null || Array.IndexOf(AllowedPlatforms, platform) < 0) return BadRequest();

            var now = DateTime.UtcNow;
            var existing = await _context.AppInstalls.FindAsync(installId);
            if (existing is null)
            {
                _context.AppInstalls.Add(new AppInstall
                {
                    InstallId = installId,
                    Platform = platform,
                    FirstSeenAt = now,
                    LastSeenAt = now,
                });
            }
            else
            {
                existing.LastSeenAt = now;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
