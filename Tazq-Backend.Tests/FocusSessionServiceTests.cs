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

            // Erken bitirilen seansın dakikaları da odaktır (ürün kararı 2026-10-29):
            // istemci bunları sayıyordu, sunucu saymıyordu — ekranlar farklı rakam gösteriyordu.
            Assert.Equal(3.0, stats.TotalFocusHours);
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

        /*
          AŞAĞIDAKİ İKİ TEST BİR BOŞLUĞU KAPATIYOR.

          İstatistik sorgusu tam satır çekmekten `DueDate` projeksiyonuna çevrildi. Mevcut
          testler toplam saat, tamamlanan sayısı ve 7 günlük yapıyı doğruluyordu — ama
          `DueDate` değerini TÜKETEN iki yolu, yani seriyi ve günlük görev kırılımını,
          hiçbir test kontrol etmiyordu. Yani projeksiyon bu iki hesabı sessizce bozsa
          paket yine yeşil kalırdı.
        */

        [Fact]
        public async Task GetUserStatsAsync_ShouldCountConsecutiveDayStreak()
        {
            var userId = 20;
            var today = DateTime.UtcNow.Date;

            // Bugün, dün, evvelsi gün → kesintisiz 3 günlük seri.
            _context.Tasks.AddRange(
                new TaskItem { UserId = userId, Title = "A", IsCompleted = true, DueDate = today },
                new TaskItem { UserId = userId, Title = "B", IsCompleted = true, DueDate = today.AddDays(-1) },
                new TaskItem { UserId = userId, Title = "C", IsCompleted = true, DueDate = today.AddDays(-2) }
            );
            await _context.SaveChangesAsync();

            var stats = await _service.GetUserStatsAsync(userId);

            Assert.Equal(3, stats.ActiveStreak);
        }

        [Fact]
        public async Task GetUserStatsAsync_ShouldBreakStreakOnGap()
        {
            var userId = 21;
            var today = DateTime.UtcNow.Date;

            // Bugün var, dün YOK, önceki günler var → seri 1'de kesilmeli.
            _context.Tasks.AddRange(
                new TaskItem { UserId = userId, Title = "A", IsCompleted = true, DueDate = today },
                new TaskItem { UserId = userId, Title = "C", IsCompleted = true, DueDate = today.AddDays(-3) },
                new TaskItem { UserId = userId, Title = "D", IsCompleted = true, DueDate = today.AddDays(-4) }
            );
            await _context.SaveChangesAsync();

            var stats = await _service.GetUserStatsAsync(userId);

            Assert.Equal(1, stats.ActiveStreak);
        }

        [Fact]
        public async Task GetUserStatsAsync_ShouldAttributeCompletedTaskToItsWeekday()
        {
            var userId = 22;
            var today = DateTime.UtcNow.Date;

            _context.Tasks.Add(new TaskItem { UserId = userId, Title = "Bugünkü", IsCompleted = true, DueDate = today });
            await _context.SaveChangesAsync();

            var stats = await _service.GetUserStatsAsync(userId);

            // Görev, haftalık kırılımda BUGÜNÜN gününe düşmeli — hepsine değil, birine.
            var todayLabel = today.ToString("ddd");
            Assert.Equal(1, stats.WeeklyFocus.Where(d => d.Day == todayLabel).Sum(d => d.TasksCompleted));
            Assert.Equal(1, stats.WeeklyFocus.Sum(d => d.TasksCompleted));
        }
        /*
            SEANS GEÇMİŞİ — gün kırılımı istemcide yapılsın diye HAM satırlar.

            Sunucu günleri UTC'ye göre kırıyordu: Türkiye'de gece 00:30'da yapılan odak
            bir önceki güne yazılıyordu ve kullanıcı grafikte yanlış günü görüyordu.
        */
        [Fact]
        public async Task GetSessionsAsync_ReturnsOwnSessionsIncludingEarlyFinishedWithinWindow()
        {
            var now = DateTime.UtcNow;
            _context.FocusSessions.AddRange(
                new FocusSession { UserId = 1, TaskName = "a", DurationMinutes = 25, Completed = true, StartedAt = now.AddDays(-1) },
                new FocusSession { UserId = 1, TaskName = "b", DurationMinutes = 50, Completed = true, StartedAt = now.AddDays(-10) },
                new FocusSession { UserId = 1, TaskName = "yarım", DurationMinutes = 5, Completed = false, StartedAt = now.AddDays(-1) },
                new FocusSession { UserId = 2, TaskName = "başkası", DurationMinutes = 99, Completed = true, StartedAt = now.AddDays(-1) }
            );
            await _context.SaveChangesAsync();

            // "yarım" (erken bitirilen) seans da gelir: o 5 dakika gerçek odaktı.
            var week = await _service.GetSessionsAsync(1, 7);
            Assert.Equal(2, week.Count);
            Assert.Equal(30, week.Sum(r => r.Minutes));

            var month = await _service.GetSessionsAsync(1, 30);
            Assert.Equal(3, month.Count);
            Assert.True(month[0].StartedAt <= month[1].StartedAt); // eskiden yeniye
        }

        [Fact]
        public async Task GetSessionsAsync_ClampsWindow()
        {
            _context.FocusSessions.Add(new FocusSession { UserId = 1, TaskName = "eski", DurationMinutes = 30, Completed = true, StartedAt = DateTime.UtcNow.AddDays(-200) });
            await _context.SaveChangesAsync();

            // 9999 gün istense de pencere 120 günle sınırlı: eski kayıt gelmez.
            Assert.Empty(await _service.GetSessionsAsync(1, 9999));
            // 0 ya da negatif istek en az 1 güne çekilir (çökmez).
            Assert.Empty(await _service.GetSessionsAsync(1, 0));
        }


        private sealed class FakeCrypto : ICryptoService
        {
            public string Encrypt(string plainText, byte[] key) => "enc:" + plainText;
            public string Decrypt(string cipherTextBase64, byte[] key) =>
                cipherTextBase64.StartsWith("enc:") ? cipherTextBase64[4..] : throw new FormatException();
            public byte[] GetKeyForUser(int userId) => new byte[32];
            public IReadOnlyList<byte[]> GetLegacyKeysForUser(int userId) => Array.Empty<byte[]>();
            public string ComputeBlindIndex(string input, byte[] key) => input;
        }

        private FocusSessionService Secure() => new FocusSessionService(_context, new FakeCrypto());

        [Fact]
        public async Task SessionName_IsStoredEncrypted_AndReturnedDecrypted()
        {
            var service = Secure();
            var saved = await service.SaveSessionAsync(1, "Tez", 25, true, 0);
            var row = await _context.FocusSessions.FindAsync(saved.Id);
            Assert.Equal("enc:Tez", row!.TaskName);

            var rows = await service.GetSessionsAsync(1, 30);
            var only = Assert.Single(rows);
            Assert.Equal(saved.Id, only.Id);
            Assert.Equal("Tez", only.TaskName);
            Assert.Equal(0, only.PausedSeconds);
            Assert.True(only.Completed);
        }

        [Theory]
        [InlineData("Focus")]
        [InlineData("")]
        public async Task AnonymousSession_HasNoName(string name)
        {
            var service = Secure();
            await service.SaveSessionAsync(1, name, 25, true);
            var row = Assert.Single(await service.GetSessionsAsync(1, 30));
            Assert.Null(row.TaskName);
            Assert.Null(row.PausedSeconds);
        }

        [Fact]
        public async Task UnreadableName_DoesNotBreakHistory()
        {
            _context.FocusSessions.Add(new FocusSession { UserId = 1, TaskName = "bozuk", DurationMinutes = 10, StartedAt = DateTime.UtcNow });
            await _context.SaveChangesAsync();
            var row = Assert.Single(await Secure().GetSessionsAsync(1, 30));
            Assert.Null(row.TaskName);
            Assert.Equal(10, row.Minutes);
        }

        [Fact]
        public async Task Sessions_OfOtherUsers_AreNeverReturned()
        {
            var service = Secure();
            await service.SaveSessionAsync(2, "Gizli", 25, true);
            Assert.Empty(await service.GetSessionsAsync(1, 30));
        }

        [Fact]
        public async Task Update_NamesAndExtendsOwnSession()
        {
            var service = Secure();
            var saved = await service.SaveSessionAsync(1, "Focus", 25, true);
            Assert.True(await service.UpdateSessionAsync(1, saved.Id, "Tez", 4));
            var row = Assert.Single(await service.GetSessionsAsync(1, 30));
            Assert.Equal("Tez", row.TaskName);
            Assert.Equal(29, row.Minutes);
        }

        [Fact]
        public async Task Update_CannotTouchOtherUsersSession()
        {
            var service = Secure();
            var saved = await service.SaveSessionAsync(2, "Gizli", 25, true);
            Assert.False(await service.UpdateSessionAsync(1, saved.Id, "Ele geçirildi", 60));
            var row = await _context.FocusSessions.FindAsync(saved.Id);
            Assert.Equal("enc:Gizli", row!.TaskName);
            Assert.Equal(25, row.DurationMinutes);
        }

        [Theory]
        [InlineData(500, 85)]
        [InlineData(-30, 25)]
        public async Task Update_AddMinutesIsBounded(int add, int expected)
        {
            var service = Secure();
            var saved = await service.SaveSessionAsync(1, "Tez", 25, true);
            await service.UpdateSessionAsync(1, saved.Id, null, add);
            var row = Assert.Single(await service.GetSessionsAsync(1, 30));
            Assert.Equal(expected, row.Minutes);
            Assert.Equal("Tez", row.TaskName);
        }
    }
}
