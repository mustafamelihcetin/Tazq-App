using Tazq_App.Models;

namespace Tazq_App.Services
{
    public interface IFocusSessionService
    {
        Task<FocusSession> SaveSessionAsync(int userId, string taskName, int durationMinutes, bool completed);
        Task<UserStats> GetUserStatsAsync(int userId);
        /// <summary>
        /// Tamamlanmış seansların HAM kaydı (başlangıç anı + dakika), son `days` gün.
        ///
        /// Neden ham: günleri ve hafta sınırını sunucu UTC'ye göre kırıyordu; Türkiye'de
        /// gece 00:30'da yapılan odak bir önceki güne yazılıyordu. Kırılımı istemci
        /// kendi takvimine göre yapsın diye satırlar olduğu gibi gönderiliyor.
        /// Yük küçük: yalnız iki sütun ve tarih sınırlı.
        /// </summary>
        Task<List<FocusSessionRow>> GetSessionsAsync(int userId, int days);
    }

    public class UserStats
    {
        public double TotalFocusHours { get; set; }
        public int CompletedTasksCount { get; set; }
        public int ActiveStreak { get; set; }
        public List<DailyFocusData> WeeklyFocus { get; set; } = new();
        public int LastWeekFocusMinutes { get; set; }
    }

    public class FocusSessionRow
    {
        public DateTime StartedAt { get; set; }
        public int Minutes { get; set; }
    }

    public class DailyFocusData
    {
        public string Day { get; set; } = string.Empty;
        public int Minutes { get; set; }
        public int TasksCompleted { get; set; }
    }
}
