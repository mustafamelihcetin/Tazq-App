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
        }

        [HttpPost("save")]
        public async Task<IActionResult> SaveSession([FromBody] SaveSessionRequest req)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var session = await _focusService.SaveSessionAsync(userId.Value, req.TaskName, req.DurationMinutes, req.Completed);
            return Ok(session);
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
