using Microsoft.EntityFrameworkCore;
using Moq;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;
using Xunit;

namespace Tazq_Backend.Tests
{
    /// <summary>Analiz Merkezi: kişi yok, yalnız toplamlar — segment, huni, benimseme, odak davranışı, kararlılık.</summary>
    public class AnalyticsServiceTests
    {
        private static readonly DateTime Now = new(2026, 10, 30, 12, 0, 0, DateTimeKind.Utc);

        private static (AppDbContext Db, AnalyticsService Svc) Make(Func<int, string?>? habits = null)
        {
            var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
            var h = new Mock<IHabitSyncService>();
            h.Setup(x => x.GetAsync(It.IsAny<int>())).ReturnsAsync((int id) => new HabitsSnapshot(habits?.Invoke(id), Now));
            return (db, new AnalyticsService(db, h.Object));
        }

        [Fact]
        public async Task Audience_EkipVeTestHesabiHaric_AcikKararKazanir()
        {
            var (db, svc) = Make();
            db.Users.AddRange(
                new User { Id = 1, Email = "1", Name = "kullanici", CreatedAt = Now.AddDays(-60), LastActiveAt = Now },
                new User { Id = 2, Email = "2", Name = "admin", Role = "Admin", CreatedAt = Now.AddDays(-60), LastActiveAt = Now },
                new User { Id = 3, Email = "3", Name = "test", AnalyticsInclude = false, CreatedAt = Now.AddDays(-60), LastActiveAt = Now },
                new User { Id = 4, Email = "4", Name = "analist-dahil", Role = "Analyst", AnalyticsInclude = true, CreatedAt = Now.AddDays(-60), LastActiveAt = Now });
            db.FocusSessions.AddRange(
                new FocusSession { UserId = 1, StartedAt = Now.AddHours(-2), DurationMinutes = 25, TaskName = "a" },
                new FocusSession { UserId = 2, StartedAt = Now.AddHours(-2), DurationMinutes = 90, TaskName = "b" },
                new FocusSession { UserId = 3, StartedAt = Now.AddHours(-2), DurationMinutes = 60, TaskName = "c" });
            await db.SaveChangesAsync();

            var r = await svc.GetReportAsync(Now);
            Assert.Equal(2, r.Segments.Total);            // 1 ve 4
            Assert.Equal(1, r.Focus.Sessions30d);         // admin ve test hesabının seansı sayılmaz
            Assert.True(AdminService.InAudience(null, "User"));
            Assert.False(AdminService.InAudience(null, "Moderator"));
            Assert.False(AdminService.InAudience(false, "User"));
        }

        [Fact]
        public async Task Segments_AreMutuallyExclusive_AndSumToTotal()
        {
            var (db, svc) = Make();
            db.Users.AddRange(
                new User { Id = 1, Email = "1", Name = "a", CreatedAt = Now.AddDays(-60), LastActiveAt = Now.AddHours(-1) },   // bugün
                new User { Id = 2, Email = "2", Name = "b", CreatedAt = Now.AddDays(-60), LastActiveAt = Now.AddDays(-3) },    // bu hafta
                new User { Id = 3, Email = "3", Name = "c", CreatedAt = Now.AddDays(-60), LastActiveAt = Now.AddDays(-20) },   // bu ay
                new User { Id = 4, Email = "4", Name = "d", CreatedAt = Now.AddDays(-90), LastActiveAt = Now.AddDays(-45) },   // uykuda
                new User { Id = 5, Email = "5", Name = "e", CreatedAt = Now.AddDays(-30), LastActiveAt = Now.AddDays(-30).AddHours(2) }, // ilk günden sonra dönmedi
                new User { Id = 6, Email = "6", Name = "f", CreatedAt = Now.AddDays(-2), LastActiveAt = Now.AddDays(-2).AddHours(1) });  // yeni
            await db.SaveChangesAsync();

            var s = (await svc.GetReportAsync(Now)).Segments;

            Assert.Equal((6, 1, 1, 1, 1, 1, 1), (s.Total, s.ActiveToday, s.ActiveWeek, s.ActiveMonth, s.Dormant, s.OneDayOnly, s.New));
            Assert.Equal(s.Total, s.ActiveToday + s.ActiveWeek + s.ActiveMonth + s.Dormant + s.OneDayOnly + s.New);
        }

        [Fact]
        public async Task Funnel_And_Adoption_CountUsersNotRows()
        {
            var (db, svc) = Make(id => id == 1 ? "[{\"id\":\"h1\"}]" : "[]");
            db.Users.AddRange(
                new User { Id = 1, Email = "1", Name = "a", IsEmailVerified = true, CreatedAt = Now.AddDays(-20), LastActiveAt = Now, HabitsData = "x",
                    Preferences = "{\"seasonal\":{\"examMode\":true}}" },
                new User { Id = 2, Email = "2", Name = "b", CreatedAt = Now.AddDays(-20), LastActiveAt = Now.AddDays(-19.5), HabitsData = "x" },
                new User { Id = 3, Email = "3", Name = "c", CreatedAt = Now.AddDays(-1), LastActiveAt = Now });
            db.Tasks.AddRange(
                new TaskItem { UserId = 1, Title = "t", IsCompleted = true, Recurrence = RecurrenceType.Daily },
                new TaskItem { UserId = 1, Title = "t", IsCompleted = true },
                new TaskItem { UserId = 2, Title = "t", IsCompleted = false, DueDate = Now });
            db.FocusSessions.Add(new FocusSession { UserId = 1, TaskName = "f", DurationMinutes = 25, Completed = true, StartedAt = Now.AddDays(-1) });
            db.Payments.Add(new Payment { UserId = 2, Title = "p", Amount = 1, DueDay = 1 });
            await db.SaveChangesAsync();

            var r = await svc.GetReportAsync(Now);
            int Step(string k) => r.Funnel.Single(f => f.Key == k).Users;
            int Use(string k) => r.Adoption.Single(a => a.Key == k).Users;

            Assert.Equal(3, Step("registered"));
            Assert.Equal(1, Step("verified"));
            Assert.Equal(2, Step("firstTask"));   // iki görev satırı olan kullanıcı BİR kez
            Assert.Equal(1, Step("firstDone"));
            Assert.Equal(1, Step("firstFocus"));
            var d7 = r.Funnel.Single(f => f.Key == "day7");
            Assert.Equal((1, 2), (d7.Users, d7.Base)); // 7 günü dolmamış kullanıcı tabanda yok

            Assert.Equal(1, Use("habits"));   // boş dizi "kullanıyor" sayılmaz
            Assert.Equal(1, Use("modes"));
            Assert.Equal(1, Use("payments"));
            Assert.Equal(1, Use("recurring"));
            Assert.Equal(1, Use("dueDates"));
        }

        [Fact]
        public async Task FocusBehavior_UsesTurkeyHours_AndCountsAbandonedMinutes()
        {
            var (db, svc) = Make();
            db.Users.Add(new User { Id = 1, Email = "1", Name = "a", CreatedAt = Now.AddDays(-60), LastActiveAt = Now });
            db.FocusSessions.AddRange(
                new FocusSession { UserId = 1, TaskName = "f", DurationMinutes = 30, Completed = true, StartedAt = new DateTime(2026, 10, 26, 18, 0, 0, DateTimeKind.Utc) }, // Pzt 21:00 TR
                new FocusSession { UserId = 1, TaskName = "f", DurationMinutes = 5, Completed = true, StartedAt = new DateTime(2026, 10, 27, 6, 0, 0, DateTimeKind.Utc) },
                new FocusSession { UserId = 1, TaskName = "f", DurationMinutes = 60, Completed = false, StartedAt = new DateTime(2026, 10, 27, 6, 0, 0, DateTimeKind.Utc) });
            await db.SaveChangesAsync();

            var f = (await svc.GetReportAsync(Now)).Focus;

            Assert.Equal(3, f.Sessions30d);
            Assert.Equal(2, f.Completed30d);
            Assert.Equal(30, f.HourMinutes[21]);
            Assert.Equal(30, f.WeekdayMinutes[0]); // Pazartesi
            Assert.Equal(30, f.Heat[0 * 24 + 21]);  // Pazartesi 21:00
            Assert.Equal(65, f.Heat[1 * 24 + 9]);   // Salı 09:00
            Assert.Equal(new[] { 1, 0, 1, 1 }, f.LengthBuckets); // <10, 10–24, 25–49, 50+ — yarım kalan 60 dk da odak
            Assert.Equal(65, f.HourMinutes[9]); // 06:00 UTC = 09:00 TR: 5 + 60
            Assert.Equal(30, f.Daily.Count);
        }

        [Fact]
        public async Task Stability_IsAggregateOnly()
        {
            var (db, svc) = Make();
            db.Users.AddRange(
                new User { Id = 1, Email = "1", Name = "a", CreatedAt = Now.AddDays(-60), LastActiveAt = Now },
                new User { Id = 2, Email = "2", Name = "b", CreatedAt = Now.AddDays(-60), LastActiveAt = Now });
            db.ClientCrashes.AddRange(
                new ClientCrash { UserId = 1, AppVersion = "2.0.0", ErrorMessage = "x", StackTrace = "s", DeviceName = "d", Platform = "android", CreatedAt = Now.AddDays(-1) },
                new ClientCrash { UserId = 1, AppVersion = "2.0.0", ErrorMessage = "x", StackTrace = "s", DeviceName = "d", Platform = "android", CreatedAt = Now.AddDays(-2) },
                new ClientCrash { UserId = 2, AppVersion = "1.6.0", ErrorMessage = "x", StackTrace = "s", DeviceName = "d", Platform = "ios", CreatedAt = Now.AddDays(-20) }); // pencere dışı
            await db.SaveChangesAsync();

            var s = (await svc.GetReportAsync(Now)).Stability;

            Assert.Equal((2, 1, 50.0), (s.Crashes7d, s.AffectedUsers7d, s.CrashFreePct!.Value));
            Assert.Equal("2.0.0", s.TopVersions[0].Version);
        }
    }
}
