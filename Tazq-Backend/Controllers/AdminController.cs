using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
    [Route("api/admin")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly IAdminService _admin;

        // Veri erişimi ve denetim kaydı IAdminService'te. Controller yalnızca
        // HTTP'yi bilir: kimlik çıkarımı, model bağlama, durum kodları.
        public AdminController(IAdminService admin)
        {
            _admin = admin;
        }

        // Denetim kaydı için admin kimliği HTTP context'ten çıkarılır ve servise geçilir;
        // servis ClaimsPrincipal'a bağımlı olmamalı (test edilebilirlik).
        private AdminIdentity CurrentAdmin() => new(
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0"),
            User.FindFirst(ClaimTypes.Name)?.Value);

        [HttpGet("users")]
        public async Task<IActionResult> GetUsers(int page = 1, int pageSize = 30, string? search = null, string? sort = "recent", bool asc = false)
        {
            var result = await _admin.GetUsersAsync(page, pageSize, search, sort, asc);
            return Ok(new { users = result.Users, total = result.Total, page, pageSize });
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats() => Ok(await _admin.GetStatsAsync());

        [HttpDelete("users/{id}")]
        public async Task<IActionResult> DeleteUser(int id)
            => await _admin.DeleteUserAsync(id, CurrentAdmin()) switch
            {
                AdminActionResult.SelfActionForbidden => BadRequest("Kendi hesabını silemezsin."),
                AdminActionResult.NotFound => NotFound(),
                _ => Ok(),
            };

        [HttpPatch("users/{id}/role")]
        public async Task<IActionResult> SetRole(int id, [FromBody] SetRoleRequest req)
            => await _admin.SetRoleAsync(id, req.Role, CurrentAdmin()) switch
            {
                AdminActionResult.SelfActionForbidden => BadRequest("Kendi rolünü değiştiremezsin."),
                AdminActionResult.NotFound => NotFound(),
                _ => Ok(),
            };

        [HttpPatch("users/{id}/ban")]
        public async Task<IActionResult> SetBan(int id, [FromBody] SetBanRequest req)
        {
            var (result, user) = await _admin.SetBanAsync(id, req.Banned, req.DurationDays, req.Reason, CurrentAdmin());
            return result switch
            {
                AdminActionResult.SelfActionForbidden => BadRequest("Kendi hesabını banlayamazsın."),
                AdminActionResult.NotFound => NotFound(),
                _ => Ok(new { user!.IsBanned, user.BannedUntil, user.BanReason }),
            };
        }

        [HttpGet("users/{id}/ban-history")]
        public async Task<IActionResult> GetBanHistory(int id)
        {
            var history = (await _admin.GetBanHistoryAsync(id))
                .Select(b => new { b.Id, b.Action, b.Reason, b.DurationDays, b.BannedUntil, b.AdminName, b.CreatedAt });
            return Ok(history);
        }

        // Tek kullanıcının detayları — görev/oturum/cihaz geçmişi
        [HttpGet("users/{id}/detail")]
        public async Task<IActionResult> GetUserDetail(int id)
        {
            var user = await _admin.GetUserWithDetailAsync(id);
            if (user == null) return NotFound();

            var recentTasks = (await _admin.GetRecentTasksAsync(id, 15))
                .Select(t => new { t.Id, t.Title, t.IsCompleted, t.DueDate, Priority = t.Priority.ToString() });
            var recentSessions = (await _admin.GetRecentSessionsAsync(id, 15))
                .Select(f => new { f.Id, f.TaskName, f.DurationMinutes, f.StartedAt, f.Completed });
            var devices = (await _admin.GetRecentDevicesAsync(id, 10))
                .Select(t => new { t.CreatedAt, t.ExpiresAt, t.RevokedAt });

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
            var export = await _admin.ExportUserAsync(id, CurrentAdmin());
            if (export == null) return NotFound();

            var user = export.Profile;
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
                tasks = export.Tasks,
                focusSessions = export.FocusSessions,
                supportMessages = export.SupportMessages,
                banHistory = export.BanHistory,
            });
        }

        // Global denetim günlüğü
        [HttpGet("audit")]
        public async Task<IActionResult> GetAuditLog(int take = 100)
        {
            var logs = (await _admin.GetAuditLogAsync(take))
                .Select(a => new { a.Id, a.AdminName, a.Action, a.TargetType, a.TargetUserId, a.TargetName, a.Details, a.CreatedAt });
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
