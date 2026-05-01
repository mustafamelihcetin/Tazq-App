using Tazq_App.Models;

namespace Tazq_App.Services
{
    public interface IFocusSessionService
    {
        Task<FocusSession> SaveSessionAsync(int userId, string taskName, int durationMinutes, bool completed);
        Task<UserStats> GetUserStatsAsync(int userId);
    }

    public class UserStats
    {
        public double TotalFocusHours { get; set; }
        public int CompletedTasksCount { get; set; }
        public int ActiveStreak { get; set; }
        public List<DailyFocusData> WeeklyFocus { get; set; } = new();
    }

    public class DailyFocusData
    {
        public string Day { get; set; } = string.Empty;
        public int Minutes { get; set; }
        public int TasksCompleted { get; set; }
    }
}
