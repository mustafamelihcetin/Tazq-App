using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Tazq_App.Data;

namespace Tazq_App.Controllers
{
    [Route("api/admin")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly AppDbContext _db;

        public AdminController(AppDbContext db)
        {
            _db = db;
        }

        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _db.Users
                .OrderByDescending(u => u.Id)
                .Select(u => new
                {
                    u.Id,
                    u.Name,
                    u.Email,
                    u.Role,
                    u.IsBanned,
                    u.ProfilePicture,
                    u.LastLoginIp,
                    TaskCount      = _db.Tasks.Count(t => t.UserId == u.Id),
                    CompletedTasks = _db.Tasks.Count(t => t.UserId == u.Id && t.IsCompleted),
                    FocusMinutes   = _db.FocusSessions
                                        .Where(f => f.UserId == u.Id && f.Completed)
                                        .Sum(f => (int?)f.DurationMinutes) ?? 0,
                    LastActivityAt = _db.FocusSessions
                                        .Where(f => f.UserId == u.Id)
                                        .OrderByDescending(f => f.StartedAt)
                                        .Select(f => (DateTime?)f.StartedAt)
                                        .FirstOrDefault(),
                })
                .ToListAsync();

            return Ok(users);
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var now = DateTime.UtcNow;
            var todayStart = now.Date;
            var weekStart  = now.Date.AddDays(-7);

            var totalUsers        = await _db.Users.CountAsync();
            var totalTasks        = await _db.Tasks.CountAsync();
            var completedTasks    = await _db.Tasks.CountAsync(t => t.IsCompleted);
            var totalFocusMinutes = await _db.FocusSessions.SumAsync(f => (int?)f.DurationMinutes) ?? 0;
            var activeToday       = await _db.FocusSessions
                                        .Where(f => f.StartedAt >= todayStart)
                                        .Select(f => f.UserId).Distinct().CountAsync();
            var activeThisWeek    = await _db.FocusSessions
                                        .Where(f => f.StartedAt >= weekStart)
                                        .Select(f => f.UserId).Distinct().CountAsync();
            var sessionsToday     = await _db.FocusSessions.CountAsync(f => f.StartedAt >= todayStart);

            // Daily focus trend — last 7 days
            var sessions = await _db.FocusSessions
                .Where(f => f.StartedAt >= weekStart && f.Completed)
                .ToListAsync();

            var dailyTrend = Enumerable.Range(0, 7).Select(i =>
            {
                var day = now.Date.AddDays(-6 + i);
                return new
                {
                    Day     = day.ToString("ddd"),
                    Minutes = sessions.Where(s => s.StartedAt.Date == day).Sum(s => s.DurationMinutes),
                };
            }).ToList();

            return Ok(new
            {
                TotalUsers        = totalUsers,
                TotalTasks        = totalTasks,
                CompletedTasks    = completedTasks,
                TotalFocusMinutes = totalFocusMinutes,
                ActiveToday       = activeToday,
                ActiveThisWeek    = activeThisWeek,
                SessionsToday     = sessionsToday,
                DailyTrend        = dailyTrend,
            });
        }

        [HttpDelete("users/{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var requesterId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            if (id == requesterId) return BadRequest("Kendi hesabını silemezsin.");

            var user = await _db.Users.FindAsync(id);
            if (user == null) return NotFound();

            _db.Users.Remove(user);
            await _db.SaveChangesAsync();
            return Ok();
        }

        [HttpPatch("users/{id}/role")]
        public async Task<IActionResult> SetRole(int id, [FromBody] SetRoleRequest req)
        {
            var requesterId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            if (id == requesterId) return BadRequest("Kendi rolünü değiştiremezsin.");

            var user = await _db.Users.FindAsync(id);
            if (user == null) return NotFound();
            user.Role = req.Role;
            await _db.SaveChangesAsync();
            return Ok();
        }

        [HttpPatch("users/{id}/ban")]
        public async Task<IActionResult> SetBan(int id, [FromBody] SetBanRequest req)
        {
            var requesterId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            if (id == requesterId) return BadRequest("Kendi hesabını banlayamazsın.");

            var user = await _db.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.IsBanned = req.Banned;
            // Banlanınca tüm aktif refresh token'ları iptal et — oturumları kısa sürede düşer
            if (req.Banned)
            {
                var now = DateTime.UtcNow;
                var tokens = await _db.RefreshTokens
                    .Where(t => t.UserId == id && t.RevokedAt == null)
                    .ToListAsync();
                foreach (var t in tokens) t.RevokedAt = now;
            }
            await _db.SaveChangesAsync();
            return Ok();
        }

        public class SetRoleRequest
        {
            public string Role { get; set; } = "User";
        }

        public class SetBanRequest
        {
            public bool Banned { get; set; }
        }
    }
}
