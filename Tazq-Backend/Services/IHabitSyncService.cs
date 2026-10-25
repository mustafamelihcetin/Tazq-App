namespace Tazq_App.Services
{
    public record HabitsSnapshot(string? Data, DateTime? UpdatedAt);

    public interface IHabitSyncService
    {
        /// <summary>Kullanıcının alışkanlık JSON'u (çözülmüş). Kullanıcı yoksa null; verisi yoksa Data null.</summary>
        Task<HabitsSnapshot?> GetAsync(int userId);

        /// <summary>Alışkanlık JSON dizisini şifreleyip saklar. Kullanıcı yoksa false.</summary>
        Task<bool> SaveAsync(int userId, string json);
    }
}
