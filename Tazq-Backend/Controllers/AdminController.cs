using Microsoft.AspNetCore.Authorization;
using Tazq_App.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
    [Route("api/admin")]
    [ApiController]
    // Sınıf: yalnız oturum. HER eylem kendi ekip politikasını açıkça taşır (StaffAuthorizationTests
    // politikasız eylemi yakalar) — sınıf düzeyi kesişim, Analist'in istatistiğe erişimini kesiyordu.
    [Authorize]
    public class AdminController : ControllerBase
    {
        private readonly IAdminService _admin;
        private readonly IAnalyticsService _analytics;

        // Veri erişimi ve denetim kaydı IAdminService'te. Controller yalnızca
        // HTTP'yi bilir: kimlik çıkarımı, model bağlama, durum kodları.
        public AdminController(IAdminService admin, IAnalyticsService analytics)
        {
            _admin = admin;
            _analytics = analytics;
        }

        // Denetim kaydı için admin kimliği HTTP context'ten çıkarılır ve servise geçilir;
        // servis ClaimsPrincipal'a bağımlı olmamalı (test edilebilirlik).
        private AdminIdentity CurrentAdmin() => new(
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0"),
            User.FindFirst(ClaimTypes.Name)?.Value);

        [HttpGet("users")]
        [Authorize(Policy = StaffPolicy.Moderation)]
        public async Task<IActionResult> GetUsers(int page = 1, int pageSize = 30, string? search = null, string? sort = "recent", bool asc = false, string? filter = null)
        {
            var result = await _admin.GetUsersAsync(page, pageSize, search, sort, asc, filter);
            return Ok(new { users = result.Users, total = result.Total, page, pageSize, counts = result.Counts });
        }

        // Analiz Merkezi: segment, huni, benimseme, odak davranışı, kararlılık — kişi yok, yalnız toplam.
        [HttpGet("analytics")]
        [Authorize(Policy = StaffPolicy.Insights)]
        public async Task<IActionResult> GetAnalytics() => Ok(await _analytics.GetReportAsync());

        [HttpGet("stats")]
        [Authorize(Policy = StaffPolicy.Insights)]
        public async Task<IActionResult> GetStats() => Ok(await _admin.GetStatsAsync());

        // Kayıtlı kullanıcılar, anonim kurulumlar ve mağaza kanalları — "Kitle" kartı.
        [HttpGet("audience")]
        [Authorize(Policy = StaffPolicy.Insights)]
        public async Task<IActionResult> GetAudience() => Ok(await _admin.GetAudienceAsync());

        // Dönemsel mod benimsenmesi + elde tutma + sürüm dağılımı — ürüne özgü içgörüler.
        [HttpGet("product-insights")]
        [Authorize(Policy = StaffPolicy.Insights)]
        public async Task<IActionResult> GetProductInsights() => Ok(await _admin.GetProductInsightsAsync());

        [HttpDelete("users/{id}")]
        [Authorize(Policy = StaffPolicy.SuperAdmin)]
        public async Task<IActionResult> DeleteUser(int id)
            => await _admin.DeleteUserAsync(id, CurrentAdmin()) switch
            {
                AdminActionResult.SelfActionForbidden => BadRequest("Kendi hesabını silemezsin."),
                AdminActionResult.NotFound => NotFound(),
                _ => Ok(),
            };

        [HttpPatch("users/{id}/role")]
        [Authorize(Policy = StaffPolicy.SuperAdmin)]
        public async Task<IActionResult> SetRole(int id, [FromBody] SetRoleRequest req)
            => await _admin.SetRoleAsync(id, req.Role, CurrentAdmin()) switch
            {
                AdminActionResult.SelfActionForbidden => BadRequest("Kendi rolünü değiştiremezsin."),
                AdminActionResult.InvalidInput => BadRequest("Geçersiz rol."),
                AdminActionResult.NotFound => NotFound(),
                _ => Ok(),
            };

        // Analize dahil mi: { include: true | false | null } — null varsayılan kurala döner (bkz. AdminService.Audience).
        [HttpPatch("users/{id}/analytics")]
        [Authorize(Policy = StaffPolicy.SuperAdmin)]
        public async Task<IActionResult> SetAnalytics(int id, [FromBody] SetAnalyticsRequest req)
            => await _admin.SetAnalyticsIncludeAsync(id, req.Include, CurrentAdmin()) == AdminActionResult.NotFound ? NotFound() : Ok();

        public class SetAnalyticsRequest { public bool? Include { get; set; } }

        [HttpPatch("users/{id}/ban")]
        [Authorize(Policy = StaffPolicy.Moderation)]
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
        [Authorize(Policy = StaffPolicy.Moderation)]
        public async Task<IActionResult> GetBanHistory(int id)
        {
            var history = (await _admin.GetBanHistoryAsync(id))
                .Select(b => new { b.Id, b.Action, b.Reason, b.DurationDays, b.BannedUntil, b.AdminName, b.CreatedAt });
            return Ok(history);
        }

        // Tek kullanıcının detayları — görev/oturum/cihaz geçmişi
        [HttpGet("users/{id}/detail")]
        [Authorize(Policy = StaffPolicy.SuperAdmin)]
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
        [Authorize(Policy = StaffPolicy.SuperAdmin)]
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
        [Authorize(Policy = StaffPolicy.SuperAdmin)]
        public async Task<IActionResult> GetAuditLog([FromQuery] int limit = 40, [FromQuery] int offset = 0, [FromQuery] int? take = null)
        {
            // `take` eski istemciler icin: yeni alan gelmezse onu limit say.
            var (items, total) = await _admin.GetAuditLogPageAsync(take ?? limit, offset);
            var logs = items.Select(a => new { a.Id, a.AdminName, a.Action, a.TargetType, a.TargetUserId, a.TargetName, a.Details, a.CreatedAt });
            return Ok(new { logs, total, offset, limit = take ?? limit, hasMore = offset + items.Count < total });
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
