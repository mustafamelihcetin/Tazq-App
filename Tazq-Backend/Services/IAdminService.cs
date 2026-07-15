using Tazq_App.Models;

namespace Tazq_App.Services
{
    // Admin panelinin veri erişimi. Controller yalnız HTTP'yi (yetki, model bağlama,
    // durum kodları) bilir; sorgular, denetim kaydı ve ban kuralları burada.
    //
    // Denetim kaydı için gereken admin kimliği (id + ad) HTTP context'ten gelir ve
    // parametre olarak geçilir — servis ClaimsPrincipal'a bağımlı olmamalı.
    public record AdminIdentity(int AdminId, string? AdminName);

    public record UserListItem(
        int Id, string Name, string Email, string Role, bool IsBanned,
        DateTime? BannedUntil, string? BanReason, DateTime? DeletedAt,
        string? ProfilePicture, string? LastLoginIp,
        int TaskCount, int CompletedTasks, int FocusMinutes, DateTime? LastActivityAt);

    public record UserListResult(List<UserListItem> Users, int Total);

    public record DailyTrendPoint(string Day, int Minutes);

    public record AdminStats(
        int TotalUsers, int TotalTasks, int CompletedTasks, int TotalFocusMinutes,
        int ActiveToday, int ActiveThisWeek, int SessionsToday, List<DailyTrendPoint> DailyTrend);

    public enum AdminActionResult { Success, NotFound, SelfActionForbidden }

    public interface IAdminService
    {
        Task<UserListResult> GetUsersAsync(int page, int pageSize, string? search, string? sort, bool asc);
        Task<AdminStats> GetStatsAsync();
        Task<AdminActionResult> DeleteUserAsync(int id, AdminIdentity admin);
        Task<AdminActionResult> SetRoleAsync(int id, string role, AdminIdentity admin);
        Task<(AdminActionResult Result, User? User)> SetBanAsync(int id, bool banned, int? durationDays, string? reason, AdminIdentity admin);
        Task<List<BanHistory>> GetBanHistoryAsync(int id);
        Task<User?> GetUserWithDetailAsync(int id);
        Task<List<TaskItem>> GetRecentTasksAsync(int userId, int take);
        Task<List<FocusSession>> GetRecentSessionsAsync(int userId, int take);
        Task<List<RefreshToken>> GetRecentDevicesAsync(int userId, int take);
        Task<UserExport?> ExportUserAsync(int id, AdminIdentity admin);
        Task<List<AdminAuditLog>> GetAuditLogAsync(int take);
    }

    public record UserExport(
        User Profile, List<TaskItem> Tasks, List<FocusSession> FocusSessions,
        List<SupportMessage> SupportMessages, List<BanHistory> BanHistory);
}
