using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
    /// <summary>
    /// Alışkanlıkların hesaba eşitlenmesi (bkz. HabitSyncService). GET kopyayı, PUT yenisini yazar.
    /// </summary>
    [Route("api/habits")]
    [ApiController]
    [Authorize]
    public class HabitsController : ControllerBase
    {
        /// <summary>
        /// ~1 MB. 15 alışkanlık × yıllarca günlük işaret rahatça sığar; sınırsız yük veritabanına
        /// doğrudan yazılmasın (tercih alanındaki aynı gerekçe, bkz. UsersController).
        /// </summary>
        public const int MaxPayloadLength = 1_000_000;

        private readonly IHabitSyncService _service;

        public HabitsController(IHabitSyncService service)
        {
            _service = service;
        }

        private int? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claim, out int id) ? id : null;
        }

        public class HabitsRequest
        {
            public string Data { get; set; } = string.Empty;
        }

        [HttpGet("sync")]
        public async Task<IActionResult> Get()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            var snapshot = await _service.GetAsync(userId.Value);
            if (snapshot == null) return NotFound();
            return Ok(new { data = snapshot.Data, updatedAt = snapshot.UpdatedAt });
        }

        [HttpPut("sync")]
        [RequestSizeLimit(MaxPayloadLength + 4096)]
        public async Task<IActionResult> Put([FromBody] HabitsRequest req)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            if (req.Data is { Length: > MaxPayloadLength })
                return BadRequest(new { error = "payload_too_large" });
            if (!HabitSyncService.IsValidPayload(req.Data))
                return BadRequest(new { error = "invalid_payload" });
            var ok = await _service.SaveAsync(userId.Value, req.Data);
            return ok ? NoContent() : NotFound();
        }
    }
}
