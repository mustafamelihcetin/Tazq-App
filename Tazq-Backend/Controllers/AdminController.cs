using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Tazq_App.Data;
using Tazq_App.Models;

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

        // Denetim günlüğüne kayıt ekler (SaveChanges çağıranda yapılır)
        private async Task WriteAuditAsync(string action, string? targetType, int? targetUserId, string? targetName, string? details)
        {
            var requesterId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var adminName = User.FindFirst(ClaimTypes.Name)?.Value
                ?? await _db.Users.IgnoreQueryFilters().Where(u => u.Id == requesterId).Select(u => u.Name).FirstOrDefaultAsync();
            _db.AdminAuditLogs.Add(new AdminAuditLog
            {
                AdminId = requesterId,
                AdminName = adminName,
                Action = action,
                TargetType = targetType,
                TargetUserId = targetUserId,
                TargetName = targetName,
                Details = details,
                CreatedAt = DateTime.UtcNow,
            });
        }

        [HttpGet("users")]
        public async Task<IActionResult> GetUsers(int page = 1, int pageSize = 30, string? search = null, string? sort = "recent", bool asc = false)
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 30;

            var q = _db.Users.IgnoreQueryFilters().AsQueryable(); // soft-delete'liler dahil
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                q = q.Where(u => u.Name.ToLower().Contains(s) || u.Email.ToLower().Contains(s));
            }

            var total = await q.CountAsync();

            // Sunucu tarafında sıralama
            switch (sort)
            {
                case "name":
                    q = asc ? q.OrderBy(u => u.Name) : q.OrderByDescending(u => u.Name);
                    break;
                case "tasks":
                    q = asc ? q.OrderBy(u => _db.Tasks.Count(t => t.UserId == u.Id))
                            : q.OrderByDescending(u => _db.Tasks.Count(t => t.UserId == u.Id));
                    break;
                case "focus":
                    q = asc ? q.OrderBy(u => _db.FocusSessions.Where(f => f.UserId == u.Id && f.Completed).Sum(f => (int?)f.DurationMinutes) ?? 0)
                            : q.OrderByDescending(u => _db.FocusSessions.Where(f => f.UserId == u.Id && f.Completed).Sum(f => (int?)f.DurationMinutes) ?? 0);
                    break;
                default: // recent — son odak aktivitesi
                    q = asc ? q.OrderBy(u => _db.FocusSessions.Where(f => f.UserId == u.Id).Max(f => (DateTime?)f.StartedAt))
                            : q.OrderByDescending(u => _db.FocusSessions.Where(f => f.UserId == u.Id).Max(f => (DateTime?)f.StartedAt));
                    break;
            }

            var users = await q
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(u => new
                {
                    u.Id,
                    u.Name,
                    u.Email,
                    u.Role,
                    u.IsBanned,
                    u.BannedUntil,
                    u.BanReason,
                    u.DeletedAt,
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

            return Ok(new { users, total, page, pageSize });
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

            var user = await _db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            // Kalıcı silme: kullanıcıya ait tüm ilişkili veriyi de temizle (FK ihlali olmasın)
            _db.Tasks.RemoveRange(_db.Tasks.Where(t => t.UserId == id));
            _db.FocusSessions.RemoveRange(_db.FocusSessions.Where(f => f.UserId == id));
            _db.RefreshTokens.RemoveRange(_db.RefreshTokens.Where(t => t.UserId == id));
            _db.SupportMessages.RemoveRange(_db.SupportMessages.Where(m => m.UserId == id));
            _db.PasswordResetTokens.RemoveRange(_db.PasswordResetTokens.Where(p => p.UserId == id));
            _db.UserNotificationPreferences.RemoveRange(_db.UserNotificationPreferences.Where(p => p.UserId == id));
            _db.ClientCrashes.RemoveRange(_db.ClientCrashes.Where(c => c.UserId == id));
            _db.BanHistories.RemoveRange(_db.BanHistories.Where(b => b.UserId == id));
            _db.Users.Remove(user);
            await WriteAuditAsync("delete_user", "user", id, user.Name, $"Kalıcı silme (hard delete) · {user.Email}");
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
            var oldRole = user.Role;
            user.Role = req.Role;
            await WriteAuditAsync("role_change", "user", id, user.Name, $"{oldRole} → {req.Role}");
            await _db.SaveChangesAsync();
            return Ok();
        }

        [HttpPatch("users/{id}/ban")]
        public async Task<IActionResult> SetBan(int id, [FromBody] SetBanRequest req)
        {
            var requesterId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            if (id == requesterId) return BadRequest("Kendi hesabını banlayamazsın.");

            var user = await _db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            var admin = await _db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == requesterId);
            var record = new BanHistory
            {
                UserId = id,
                Action = req.Banned ? "ban" : "unban",
                AdminId = requesterId,
                AdminName = admin?.Name,
                CreatedAt = DateTime.UtcNow,
            };

            if (req.Banned)
            {
                var reason = string.IsNullOrWhiteSpace(req.Reason) ? "Belirtilmedi" : req.Reason!.Trim();
                if (reason.Length > 200) reason = reason.Substring(0, 200);

                if (req.DurationDays.HasValue && req.DurationDays.Value > 0)
                {
                    // Süreli ban: süre dolunca otomatik kalkar
                    user.IsBanned = false;
                    user.BannedUntil = DateTime.UtcNow.AddDays(req.DurationDays.Value);
                }
                else
                {
                    // Kalıcı ban
                    user.IsBanned = true;
                    user.BannedUntil = null;
                }
                user.BanReason = reason;
                record.Reason = reason;
                record.DurationDays = req.DurationDays;
                record.BannedUntil = user.BannedUntil;

                // Banlanınca tüm aktif refresh token'ları iptal et — oturumları kısa sürede düşer
                var now = DateTime.UtcNow;
                var tokens = await _db.RefreshTokens
                    .Where(t => t.UserId == id && t.RevokedAt == null)
                    .ToListAsync();
                foreach (var t in tokens) t.RevokedAt = now;
            }
            else
            {
                // Banı kaldır
                user.IsBanned = false;
                user.BannedUntil = null;
                user.BanReason = null;
            }

            _db.BanHistories.Add(record);
            var auditDetail = req.Banned
                ? $"{record.Reason} · {(req.DurationDays.HasValue && req.DurationDays.Value > 0 ? $"{req.DurationDays} gün" : "kalıcı")}"
                : "Ban kaldırıldı";
            await WriteAuditAsync(req.Banned ? "ban" : "unban", "user", id, user.Name, auditDetail);
            await _db.SaveChangesAsync();
            return Ok(new { user.IsBanned, user.BannedUntil, user.BanReason });
        }

        [HttpGet("users/{id}/ban-history")]
        public async Task<IActionResult> GetBanHistory(int id)
        {
            var history = await _db.BanHistories
                .Where(b => b.UserId == id)
                .OrderByDescending(b => b.CreatedAt)
                .Take(50)
                .Select(b => new
                {
                    b.Id,
                    b.Action,
                    b.Reason,
                    b.DurationDays,
                    b.BannedUntil,
                    b.AdminName,
                    b.CreatedAt,
                })
                .ToListAsync();
            return Ok(history);
        }

        // Tek kullanıcının detayları — görev/oturum/cihaz geçmişi
        [HttpGet("users/{id}/detail")]
        public async Task<IActionResult> GetUserDetail(int id)
        {
            var user = await _db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            var recentTasks = await _db.Tasks.Where(t => t.UserId == id)
                .OrderByDescending(t => t.Id).Take(15)
                .Select(t => new { t.Id, t.Title, t.IsCompleted, t.DueDate, Priority = t.Priority.ToString() })
                .ToListAsync();

            var recentSessions = await _db.FocusSessions.Where(f => f.UserId == id)
                .OrderByDescending(f => f.StartedAt).Take(15)
                .Select(f => new { f.Id, f.TaskName, f.DurationMinutes, f.StartedAt, f.Completed })
                .ToListAsync();

            var devices = await _db.RefreshTokens.Where(t => t.UserId == id)
                .OrderByDescending(t => t.CreatedAt).Take(10)
                .Select(t => new { t.CreatedAt, t.ExpiresAt, t.RevokedAt })
                .ToListAsync();

            return Ok(new
            {
                email = user.Email,
                phoneNumber = user.PhoneNumber,
                motto = user.Motto,
                isEmailVerified = user.IsEmailVerified,
                lastLoginIp = user.LastLoginIp,
                recentTasks,
                recentSessions,
                devices,
            });
        }

        // KVKK/GDPR — kullanıcının tüm verisini JSON olarak dışa aktarır
        [HttpGet("users/{id}/export")]
        public async Task<IActionResult> ExportUser(int id)
        {
            var user = await _db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            var tasks = await _db.Tasks.Where(t => t.UserId == id).ToListAsync();
            var sessions = await _db.FocusSessions.Where(f => f.UserId == id).ToListAsync();
            var support = await _db.SupportMessages.Where(m => m.UserId == id).ToListAsync();
            var bans = await _db.BanHistories.Where(b => b.UserId == id).ToListAsync();

            await WriteAuditAsync("export", "user", id, user.Name, $"KVKK veri ihracı · {user.Email}");
            await _db.SaveChangesAsync();

            return Ok(new
            {
                exportedAt = DateTime.UtcNow,
                profile = new
                {
                    user.Id,
                    user.Name,
                    user.Email,
                    user.Role,
                    user.PhoneNumber,
                    user.Motto,
                    user.IsEmailVerified,
                    user.LastLoginIp,
                    user.IsBanned,
                    user.BannedUntil,
                    user.BanReason,
                    user.DeletedAt,
                    user.Preferences,
                },
                tasks,
                focusSessions = sessions,
                supportMessages = support,
                banHistory = bans,
            });
        }

        // Global denetim günlüğü
        [HttpGet("audit")]
        public async Task<IActionResult> GetAuditLog(int take = 100)
        {
            if (take < 1 || take > 500) take = 100;
            var logs = await _db.AdminAuditLogs
                .OrderByDescending(a => a.CreatedAt)
                .Take(take)
                .Select(a => new { a.Id, a.AdminName, a.Action, a.TargetType, a.TargetUserId, a.TargetName, a.Details, a.CreatedAt })
                .ToListAsync();
            return Ok(logs);
        }

        public class SetRoleRequest
        {
            public string Role { get; set; } = "User";
        }

        public class SetBanRequest
        {
            public bool Banned { get; set; }
            public int? DurationDays { get; set; } // null / 0 => kalıcı ban; > 0 => süreli ban (gün)
            public string? Reason { get; set; }    // ban sebebi (seçenek etiketi veya serbest metin)
        }
    }
}
