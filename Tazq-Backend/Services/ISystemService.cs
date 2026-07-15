namespace Tazq_App.Services
{
    public record SystemHealth(
        bool DbOk, bool? RedisOk, string? LatestMigration, int PendingMigrations);

    public record SystemStats(
        int Users, int Tasks, int FocusSessions, int SupportMessages, int SupportUnread, int ContentDocuments);

    public record MigrateResult(bool Success, List<string> Applied, string? Error);

    // Sistem konsolunun altyapı işleri (sağlık, migration, cache) ve sayımları.
    // Controller'dan ayrıldı ki bu mantık test edilebilsin ve HTTP katmanı ince kalsın.
    public interface ISystemService
    {
        Task<SystemHealth> GetHealthAsync();
        Task<SystemStats> GetStatsAsync();
        Task<MigrateResult> ApplyPendingMigrationsAsync();

        /// <summary>Redis bağlı değilse false döner (yerel/InMemory kurulum).</summary>
        Task<bool> ClearCacheAsync();

        Task WriteMaintenanceAuditAsync(AdminIdentity admin, string details);
    }
}
