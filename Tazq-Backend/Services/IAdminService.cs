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
        int TaskCount, int CompletedTasks, int FocusMinutes, DateTime? LastActivityAt,
        bool? AnalyticsInclude = null, bool InAnalytics = true);

    /// <param name="Counts">Yalnız ilk sayfada: aramaya uyanların filtre başına sayısı (çiplerdeki sayılar).</param>
    public record UserListResult(List<UserListItem> Users, int Total, Dictionary<string, int>? Counts = null);

    // Day: eski istemciler için kısa gün adı (sunucu kültürü — İngilizce); Date: yyyy-MM-dd,
    // yeni istemci kendi dilinde biçimlendirir.
    public record DailyTrendPoint(string Day, int Minutes, string Date);

    /// <summary>
    /// Genel bakış. "Bu hafta / geçen hafta" = son 7 gün / ondan önceki 7 gün (UTC).
    /// SeenToday/Seen7d: GERÇEK son görülme (LastActiveAt) — ActiveToday/ActiveThisWeek yalnız
    /// odak seansı açanları sayar (eski alanlar, uyum için duruyor). Görevlerde zaman damgası
    /// olmadığından görev için haftalık kıyas YOK (ölçülmeyeni gösterme).
    /// </summary>
    public record AdminStats(
        int TotalUsers, int TotalTasks, int CompletedTasks, int TotalFocusMinutes,
        int ActiveToday, int ActiveThisWeek, int SessionsToday, List<DailyTrendPoint> DailyTrend,
        int SeenToday = 0, int Seen7d = 0,
        int NewUsers7d = 0, int NewUsersPrev7d = 0,
        int FocusMinutes7d = 0, int FocusMinutesPrev7d = 0);

    public record RegisteredAudience(int Total, int EmailVerified, int Deleted);

    public record InstallAudience(int Total, int ActiveLast7Days, int ActiveLast30Days);

    // Status: "not_configured" (kimlik bilgisi yok) | "pending_api" (bilgi var, çekim henüz bağlı değil).
    // Downloads/Rating yalnız gerçek API bağlandığında dolar; o zamana kadar null.
    public record StoreChannelStatus(string Status, int? Downloads, double? Rating, int? RatingCount);

    public record AudienceStats(
        RegisteredAudience Registered, InstallAudience Installs,
        StoreChannelStatus AppStore, StoreChannelStatus PlayStore);

    public enum AdminActionResult { Success, NotFound, SelfActionForbidden, InvalidInput }

    /// <summary>
    /// Bir dönemsel modun (sınav, tez, spor…) benimsenme özeti.
    /// `ActiveUsers`: şu an o modu açık tutan kullanıcı sayısı (User.Preferences → seasonal).
    /// `ClosedGoals`/`AvgDurationDays`/`AvgEffortDays`: KAPANMIŞ hedeflerin geçmişinden
    /// (goalHistory) — "insanlar bu modda ne kadar kalıyor, kaç gününde gerçekten çalışıyor".
    /// </summary>
    public record ModeAdoption(string Mode, int ActiveUsers, int ClosedGoals, double? AvgDurationDays, double? AvgEffortDays);

    /// <summary>
    /// Haftalık kayıt kohortu — o hafta kaydolanların kaçı 7 gün sonra hâlâ görünüyordu.
    /// Kohort, kaydolduktan en az 7 gün geçmiş kullanıcılarla sınırlı (aksi halde "henüz
    /// 7 günü dolmamış" biri yanlışlıkla "kaybedilmiş" sayılır).
    /// </summary>
    // WeekStart: yyyy-MM-dd — istemci kendi dilinde biçimler (WeekLabel sunucu kültüründe, İngilizce).
    public record RetentionCohort(string WeekLabel, int NewUsers, int StillActiveAfter7d, string? WeekStart = null);

    public record VersionShare(string Version, int Users);

    public record ProductInsights(
        List<ModeAdoption> Modes, int UsersWithPreferences,
        List<RetentionCohort> Retention,
        List<VersionShare> Versions, int UsersWithKnownVersion, int TotalUsers);

    public interface IAdminService
    {
        Task<UserListResult> GetUsersAsync(int page, int pageSize, string? search, string? sort, bool asc, string? filter = null);
        Task<AdminStats> GetStatsAsync();
        Task<AudienceStats> GetAudienceAsync();
        Task<ProductInsights> GetProductInsightsAsync();
        Task<AdminActionResult> DeleteUserAsync(int id, AdminIdentity admin);
        Task<AdminActionResult> SetRoleAsync(int id, string role, AdminIdentity admin);
        /// <summary>Analize dahil mi: null = varsayılan kural, true/false = açık karar.</summary>
        Task<AdminActionResult> SetAnalyticsIncludeAsync(int id, bool? include, AdminIdentity admin);
        Task<(AdminActionResult Result, User? User)> SetBanAsync(int id, bool banned, int? durationDays, string? reason, AdminIdentity admin);
        Task<List<BanHistory>> GetBanHistoryAsync(int id);
        Task<User?> GetUserWithDetailAsync(int id);
        Task<List<TaskItem>> GetRecentTasksAsync(int userId, int take);
        Task<List<FocusSession>> GetRecentSessionsAsync(int userId, int take);
        Task<List<RefreshToken>> GetRecentDevicesAsync(int userId, int take);
        Task<UserExport?> ExportUserAsync(int id, AdminIdentity admin);
        /// <summary>
        /// Denetim gunlugu — SAYFALANMIS. Panel 100 cekip 40'ini ciziyordu: 60 kayit
        /// aga gidiyor, kullaniciya hic gosterilmiyordu.
        /// </summary>
        Task<(List<AdminAuditLog> Items, int Total)> GetAuditLogPageAsync(int limit, int offset);
    }

    public record UserExport(
        User Profile, List<TaskItem> Tasks, List<FocusSession> FocusSessions,
        List<SupportMessage> SupportMessages, List<BanHistory> BanHistory);
}
