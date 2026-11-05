using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
    [Route("api/focus")]
    [ApiController]
    [Authorize]
    public class FocusSessionController : ControllerBase
    {
        private readonly IFocusSessionService _focusService;

        public FocusSessionController(IFocusSessionService focusService)
        {
            _focusService = focusService;
        }

        private int? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claim, out int id) ? id : null;
        }

        public class SaveSessionRequest
        {
            public string TaskName { get; set; } = string.Empty;
            public int DurationMinutes { get; set; }
            public bool Completed { get; set; } = true;
            public int? PausedSeconds { get; set; }
        }

        public class UpdateSessionRequest
        {
            public string? TaskName { get; set; }
            public int? AddMinutes { get; set; }
        }

        /// <summary>Seans sonunda ad ya da alarm sonrası süre ekler. Başkasının seansı 404.</summary>
        [HttpPatch("sessions/{id:int}")]
        public async Task<IActionResult> UpdateSession(int id, [FromBody] UpdateSessionRequest req)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            return await _focusService.UpdateSessionAsync(userId.Value, id, req.TaskName, req.AddMinutes) ? NoContent() : NotFound();
        }

        [HttpPost("save")]
        public async Task<IActionResult> SaveSession([FromBody] SaveSessionRequest req)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var session = await _focusService.SaveSessionAsync(userId.Value, req.TaskName, req.DurationMinutes, req.Completed, req.PausedSeconds);
            return Ok(session);
        }

        /// <summary>
        /// Seans geçmişi — gün kırılımını İSTEMCİ kendi saat dilimine göre yapar.
        /// Yalnız isteği yapan kullanıcının kendi kayıtları döner.
        /// </summary>
        [HttpGet("sessions")]
        public async Task<IActionResult> GetSessions([FromQuery] int days = 63)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var rows = await _focusService.GetSessionsAsync(userId.Value, days);
            return Ok(rows);
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var stats = await _focusService.GetUserStatsAsync(userId.Value);
            return Ok(stats);
        }
    }
}
