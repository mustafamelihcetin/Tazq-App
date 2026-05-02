using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    public class FocusSessionServiceTests
    {
        private readonly AppDbContext _context;
        private readonly FocusSessionService _service;

        public FocusSessionServiceTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new AppDbContext(options);
            _service = new FocusSessionService(_context);
        }

        [Fact]
        public async Task SaveSessionAsync_ShouldPersistSession()
        {
            var session = await _service.SaveSessionAsync(1, "Write tests", 25, true);

            Assert.NotNull(session);
            Assert.Equal(1, session.UserId);
            Assert.Equal("Write tests", session.TaskName);
            Assert.Equal(25, session.DurationMinutes);
            Assert.True(session.Completed);

            var inDb = await _context.FocusSessions.FindAsync(session.Id);
            Assert.NotNull(inDb);
        }

        [Fact]
        public async Task GetUserStatsAsync_ShouldReturnZeroStats_WhenNoData()
        {
            var stats = await _service.GetUserStatsAsync(99);

            Assert.Equal(0, stats.TotalFocusHours);
            Assert.Equal(0, stats.CompletedTasksCount);
            Assert.Equal(0, stats.ActiveStreak);
            Assert.Equal(7, stats.WeeklyFocus.Count);
        }

        [Fact]
        public async Task GetUserStatsAsync_ShouldCalculateTotalFocusHours()
        {
            var userId = 2;
            _context.FocusSessions.AddRange(
                new FocusSession { UserId = userId, TaskName = "A", DurationMinutes = 30, Completed = true, StartedAt = DateTime.UtcNow },
                new FocusSession { UserId = userId, TaskName = "B", DurationMinutes = 90, Completed = true, StartedAt = DateTime.UtcNow },
                new FocusSession { UserId = userId, TaskName = "C", DurationMinutes = 60, Completed = false, StartedAt = DateTime.UtcNow }
            );
            await _context.SaveChangesAsync();

            var stats = await _service.GetUserStatsAsync(userId);

            Assert.Equal(2.0, stats.TotalFocusHours);
        }

        [Fact]
        public async Task GetUserStatsAsync_ShouldCountCompletedTasks()
        {
            var userId = 3;
            _context.Tasks.AddRange(
                new TaskItem { UserId = userId, Title = "T1", IsCompleted = true },
                new TaskItem { UserId = userId, Title = "T2", IsCompleted = true },
                new TaskItem { UserId = userId, Title = "T3", IsCompleted = false }
            );
            await _context.SaveChangesAsync();

            var stats = await _service.GetUserStatsAsync(userId);

            Assert.Equal(2, stats.CompletedTasksCount);
        }

        [Fact]
        public async Task GetUserStatsAsync_ShouldReturnWeeklyFocusWith7Days()
        {
            var stats = await _service.GetUserStatsAsync(10);

            Assert.Equal(7, stats.WeeklyFocus.Count);
        }

        [Fact]
        public async Task GetUserStatsAsync_ShouldNotMixDataBetweenUsers()
        {
            _context.FocusSessions.Add(new FocusSession { UserId = 5, TaskName = "X", DurationMinutes = 120, Completed = true, StartedAt = DateTime.UtcNow });
            await _context.SaveChangesAsync();

            var stats = await _service.GetUserStatsAsync(6);

            Assert.Equal(0, stats.TotalFocusHours);
        }
    }
}
