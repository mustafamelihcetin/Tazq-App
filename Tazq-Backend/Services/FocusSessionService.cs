using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    public class FocusSessionService : IFocusSessionService
    {
        private readonly AppDbContext _db;

        public FocusSessionService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<FocusSession> SaveSessionAsync(int userId, string taskName, int durationMinutes, bool completed)
        {
            var session = new FocusSession
            {
                UserId = userId,
                TaskName = taskName,
                DurationMinutes = durationMinutes,
                Completed = completed,
                StartedAt = DateTime.UtcNow
            };
            _db.FocusSessions.Add(session);
            await _db.SaveChangesAsync();
            return session;
        }

        public async Task<UserStats> GetUserStatsAsync(int userId)
        {
            var now = DateTime.UtcNow;
            var sevenDaysAgo = now.AddDays(-7).Date;

            // Fetch all necessary data in two optimized queries
            var sessions = await _db.FocusSessions
                .Where(f => f.UserId == userId && f.Completed)
                .ToListAsync();

            var allCompletedTasks = await _db.Tasks
                .Where(t => t.UserId == userId && t.IsCompleted)
                .ToListAsync();

            var totalMinutes = sessions.Sum(s => s.DurationMinutes);
            var totalFocusHours = Math.Round(totalMinutes / 60.0, 1);
            var completedTasksCount = allCompletedTasks.Count;

            // Streak calculation in-memory
            var completedDates = allCompletedTasks
                .Select(t => t.DueDate.Date)
                .Distinct()
                .OrderByDescending(d => d)
                .ToList();

            int streak = 0;
            var checkDate = now.Date;
            foreach (var date in completedDates)
            {
                if (date == checkDate || date == checkDate.AddDays(-1))
                {
                    // If it matches today or yesterday (to continue a streak started before today)
                    if (streak == 0 && date < checkDate.AddDays(-1)) break; 
                    
                    streak++;
                    checkDate = date.AddDays(-1);
                }
                else break;
            }

            // Last 7 days focus data in-memory
            var weeklyFocus = new List<DailyFocusData>();
            for (int i = 6; i >= 0; i--)
            {
                var day = now.AddDays(-i).Date;
                var dayMinutes = sessions
                    .Where(s => s.StartedAt.Date == day)
                    .Sum(s => s.DurationMinutes);
                
                var dayTasksCompleted = allCompletedTasks
                    .Count(t => t.DueDate.Date == day);

                weeklyFocus.Add(new DailyFocusData
                {
                    Day = day.ToString("ddd"),
                    Minutes = dayMinutes,
                    TasksCompleted = dayTasksCompleted
                });
            }

            return new UserStats
            {
                TotalFocusHours = totalFocusHours,
                CompletedTasksCount = completedTasksCount,
                ActiveStreak = streak,
                WeeklyFocus = weeklyFocus
            };
        }
    }
}
