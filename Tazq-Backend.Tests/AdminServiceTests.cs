using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    public class AdminServiceTests
    {
        private readonly AppDbContext _context;
        private readonly AdminService _service;
        private readonly AdminIdentity _admin = new(1, "Admin User");

        public AdminServiceTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new AppDbContext(options);
            _service = new AdminService(_context, new Moq.Mock<IStoreMetricsService>().Object);
        }

        private async Task<User> SeedUserAsync(int id, string email, string role = "User")
        {
            var user = new User { Id = id, Email = email, Name = $"User{id}", Role = role };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            return user;
        }

        // ─── Kendi hesabına müdahale koruması ───────────────────────────────────

        [Fact]
        public async Task DeleteUserAsync_ShouldRefuse_WhenTargetIsSelf()
        {
            await SeedUserAsync(1, "admin@test.com", "Admin");

            var result = await _service.DeleteUserAsync(1, _admin);

            // Admin kendini silememeli — aksi halde sistem adminsiz kalabilir.
            Assert.Equal(AdminActionResult.SelfActionForbidden, result);
            Assert.NotNull(await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == 1));
        }

        [Fact]
        public async Task SetRoleAsync_ShouldRefuse_WhenTargetIsSelf()
        {
            await SeedUserAsync(1, "admin@test.com", "Admin");
            Assert.Equal(AdminActionResult.SelfActionForbidden, await _service.SetRoleAsync(1, "User", _admin));
        }

        [Fact]
        public async Task SetBanAsync_ShouldRefuse_WhenTargetIsSelf()
        {
            await SeedUserAsync(1, "admin@test.com", "Admin");
            var (result, _) = await _service.SetBanAsync(1, true, null, "sebep", _admin);
            Assert.Equal(AdminActionResult.SelfActionForbidden, result);
        }

        [Fact]
        public async Task Actions_ShouldReportNotFound_ForMissingUser()
        {
            Assert.Equal(AdminActionResult.NotFound, await _service.DeleteUserAsync(999, _admin));
            Assert.Equal(AdminActionResult.NotFound, await _service.SetRoleAsync(999, "User", _admin));
            var (banResult, _) = await _service.SetBanAsync(999, true, null, null, _admin);
            Assert.Equal(AdminActionResult.NotFound, banResult);
        }

        // ─── Silme bütünlüğü ────────────────────────────────────────────────────

        [Fact]
        public async Task DeleteUserAsync_ShouldPurgeAllRelatedData()
        {
            var target = await SeedUserAsync(2, "target@test.com");
            _context.Tasks.Add(new TaskItem { UserId = 2, Title = "t" });
            _context.FocusSessions.Add(new FocusSession { UserId = 2, TaskName = "f", DurationMinutes = 5 });
            _context.RefreshTokens.Add(new RefreshToken { UserId = 2, TokenHash = "h", ExpiresAt = DateTime.UtcNow.AddDays(1) });
            _context.SupportMessages.Add(new SupportMessage { UserId = 2, Message = "m", UserEmail = target.Email, UserName = target.Name });
            _context.BanHistories.Add(new BanHistory { UserId = 2, Action = "ban" });
            await _context.SaveChangesAsync();

            var result = await _service.DeleteUserAsync(2, _admin);

            // Yetim kayıt kalmamalı: FK ihlali ve "silinmiş kullanıcının verisi" sızıntısı olmasın.
            Assert.Equal(AdminActionResult.Success, result);
            Assert.False(await _context.Tasks.AnyAsync(t => t.UserId == 2));
            Assert.False(await _context.FocusSessions.AnyAsync(f => f.UserId == 2));
            Assert.False(await _context.RefreshTokens.AnyAsync(t => t.UserId == 2));
            Assert.False(await _context.SupportMessages.AnyAsync(m => m.UserId == 2));
            Assert.False(await _context.BanHistories.AnyAsync(b => b.UserId == 2));
            Assert.Null(await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == 2));
        }

        [Fact]
        public async Task DeleteUserAsync_ShouldWriteAuditLog()
        {
            await SeedUserAsync(2, "target@test.com");

            await _service.DeleteUserAsync(2, _admin);

            var audit = await _context.AdminAuditLogs.SingleAsync();
            Assert.Equal("delete_user", audit.Action);
            Assert.Equal(_admin.AdminId, audit.AdminId);
            Assert.Equal(2, audit.TargetUserId);
        }

        // ─── Ban kuralları ──────────────────────────────────────────────────────

        [Fact]
        public async Task SetBanAsync_PermanentBan_ShouldSetIsBannedWithoutExpiry()
        {
            await SeedUserAsync(2, "t@test.com");

            var (result, user) = await _service.SetBanAsync(2, true, null, "spam", _admin);

            Assert.Equal(AdminActionResult.Success, result);
            Assert.True(user!.IsBanned);
            Assert.Null(user.BannedUntil);
            Assert.Equal("spam", user.BanReason);
        }

        [Fact]
        public async Task SetBanAsync_TimedBan_ShouldSetExpiryAndLeaveIsBannedFalse()
        {
            await SeedUserAsync(2, "t@test.com");

            var (_, user) = await _service.SetBanAsync(2, true, 7, "spam", _admin);

            // Süreli ban IsBanned kullanmaz; süre dolunca kendiliğinden kalkmalı.
            Assert.False(user!.IsBanned);
            Assert.NotNull(user.BannedUntil);
            Assert.True(user.BannedUntil > DateTime.UtcNow.AddDays(6));
            Assert.True(user.IsCurrentlyBanned);
        }

        [Fact]
        public async Task SetBanAsync_ShouldRevokeActiveRefreshTokens()
        {
            await SeedUserAsync(2, "t@test.com");
            _context.RefreshTokens.Add(new RefreshToken { UserId = 2, TokenHash = "a", ExpiresAt = DateTime.UtcNow.AddDays(7) });
            await _context.SaveChangesAsync();

            await _service.SetBanAsync(2, true, null, "spam", _admin);

            // Ban oturumu hemen düşürmeli; aksi halde banlı kullanıcı token'ıyla devam eder.
            Assert.False(await _context.RefreshTokens.AnyAsync(t => t.UserId == 2 && t.RevokedAt == null));
        }

        [Fact]
        public async Task SetBanAsync_ShouldTruncateOverlongReason()
        {
            await SeedUserAsync(2, "t@test.com");
            var longReason = new string('x', 500);

            var (_, user) = await _service.SetBanAsync(2, true, null, longReason, _admin);

            // BanReason sütunu 200 karakterle sınırlı — kırpılmazsa yazma hatası olur.
            Assert.Equal(200, user!.BanReason!.Length);
        }

        [Fact]
        public async Task SetBanAsync_ShouldDefaultReason_WhenBlank()
        {
            await SeedUserAsync(2, "t@test.com");
            var (_, user) = await _service.SetBanAsync(2, true, null, "   ", _admin);
            Assert.Equal("Belirtilmedi", user!.BanReason);
        }

        [Fact]
        public async Task SetBanAsync_Unban_ShouldClearAllBanFields()
        {
            await SeedUserAsync(2, "t@test.com");
            await _service.SetBanAsync(2, true, 7, "spam", _admin);

            var (_, user) = await _service.SetBanAsync(2, false, null, null, _admin);

            Assert.False(user!.IsBanned);
            Assert.Null(user.BannedUntil);
            Assert.Null(user.BanReason);
            Assert.False(user.IsCurrentlyBanned);
        }

        [Fact]
        public async Task SetBanAsync_ShouldRecordBanHistory()
        {
            await SeedUserAsync(2, "t@test.com");

            await _service.SetBanAsync(2, true, 3, "spam", _admin);
            await _service.SetBanAsync(2, false, null, null, _admin);

            var history = await _service.GetBanHistoryAsync(2);
            Assert.Equal(2, history.Count);
            Assert.Equal("unban", history[0].Action); // en yeni önce
            Assert.Equal("ban", history[1].Action);
            Assert.Equal(3, history[1].DurationDays);
        }

        // ─── Listeleme / arama / sayfalama ──────────────────────────────────────

        [Fact]
        public async Task GetUsersAsync_ShouldIncludeSoftDeletedUsers()
        {
            await SeedUserAsync(2, "active@test.com");
            var deleted = await SeedUserAsync(3, "deleted@test.com");
            deleted.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var result = await _service.GetUsersAsync(1, 30, null, "name", true);

            // Admin paneli soft-delete'li hesapları da görmeli (global filtre atlanır).
            Assert.Equal(2, result.Total);
        }

        [Fact]
        public async Task GetUsersAsync_ShouldFilterBySearch_CaseInsensitively()
        {
            await SeedUserAsync(2, "melih@test.com");
            await SeedUserAsync(3, "other@test.com");

            var result = await _service.GetUsersAsync(1, 30, "melih", "name", true);

            Assert.Equal(1, result.Total);
            Assert.Equal("melih@test.com", result.Users[0].Email);
        }

        [Fact]
        public async Task GetUsersAsync_ShouldMatchUppercaseI_UnderTurkishCulture()
        {
            // Regresyon: tr-TR kültüründe "MELIH".ToLower() → "melıh" (noktasız ı) üretir ve
            // "melih" ile eşleşmez. Arama terimi ToLowerInvariant ile küçültülmezse, Türkçe
            // locale'li sunucuda büyük "I" içeren aramalar sessizce boş sonuç döner.
            var previous = CultureInfo.CurrentCulture;
            try
            {
                CultureInfo.CurrentCulture = new CultureInfo("tr-TR");
                await SeedUserAsync(2, "melih@test.com");
                await SeedUserAsync(3, "other@test.com");

                var result = await _service.GetUsersAsync(1, 30, "MELIH", "name", true);

                Assert.Equal(1, result.Total);
                Assert.Equal("melih@test.com", result.Users[0].Email);
            }
            finally
            {
                CultureInfo.CurrentCulture = previous;
            }
        }

        [Fact]
        public async Task GetUsersAsync_Filters_AndCountsOnFirstPage()
        {
            var now = DateTime.UtcNow;
            var active = await SeedUserAsync(2, "active@test.com"); active.LastActiveAt = now.AddDays(-1); active.IsEmailVerified = true;
            var stale = await SeedUserAsync(3, "stale@test.com"); stale.LastActiveAt = now.AddDays(-30); stale.IsEmailVerified = true;
            var unverified = await SeedUserAsync(4, "new@test.com");
            var banned = await SeedUserAsync(5, "ban@test.com"); banned.IsBanned = true; banned.IsEmailVerified = true;
            var tempBanOver = await SeedUserAsync(6, "temp@test.com"); tempBanOver.BannedUntil = now.AddDays(-1); tempBanOver.IsEmailVerified = true;
            var tempBan = await SeedUserAsync(7, "temp2@test.com"); tempBan.BannedUntil = now.AddDays(2); tempBan.IsEmailVerified = true;
            await SeedUserAsync(8, "staff@test.com", "Analyst");
            var gone = await SeedUserAsync(9, "gone@test.com"); gone.DeletedAt = now; gone.LastActiveAt = now;
            await _context.SaveChangesAsync();

            Assert.Equal(new[] { 2 }, (await _service.GetUsersAsync(1, 30, null, "name", true, "active")).Users.Select(u => u.Id));
            Assert.Equal(new[] { 5, 7 }, (await _service.GetUsersAsync(1, 30, null, "name", true, "banned")).Users.Select(u => u.Id).OrderBy(i => i));
            // Silinmiş hesap aktif/doğrulanmamış sayılmaz; yalnız "silinmiş" çipinde görünür.
            Assert.DoesNotContain(9, (await _service.GetUsersAsync(1, 30, null, "name", true, "unverified")).Users.Select(u => u.Id));
            Assert.Equal(new[] { 9 }, (await _service.GetUsersAsync(1, 30, null, "name", true, "deleted")).Users.Select(u => u.Id));
            Assert.Equal(8, (await _service.GetUsersAsync(1, 30, null, "name", true, "nonsense")).Total); // bilinmeyen = filtre yok

            var first = await _service.GetUsersAsync(1, 30, null, "name", true, "banned");
            Assert.NotNull(first.Counts);
            Assert.Equal(1, first.Counts!["active"]);
            Assert.Equal(2, first.Counts["banned"]);
            Assert.Equal(1, first.Counts["staff"]);
            Assert.Equal(1, first.Counts["deleted"]);
            Assert.Null((await _service.GetUsersAsync(2, 30, null, "name", true)).Counts); // yalnız ilk sayfa
        }

        [Fact]
        public async Task GetUsersAsync_ShouldClampInvalidPaging()
        {
            for (int i = 2; i < 10; i++) await SeedUserAsync(i, $"u{i}@test.com");

            // Geçersiz sayfa/boyut kırılma değil, güvenli varsayılan üretmeli.
            var result = await _service.GetUsersAsync(0, 0, null, "name", true);

            Assert.Equal(8, result.Total);
            Assert.True(result.Users.Count <= 30);
        }

        [Fact]
        public async Task GetUsersAsync_ShouldAggregateTaskAndFocusCounts()
        {
            await SeedUserAsync(2, "t@test.com");
            _context.Tasks.Add(new TaskItem { UserId = 2, Title = "a", IsCompleted = true });
            _context.Tasks.Add(new TaskItem { UserId = 2, Title = "b", IsCompleted = false });
            _context.FocusSessions.Add(new FocusSession { UserId = 2, TaskName = "f", DurationMinutes = 25, Completed = true });
            await _context.SaveChangesAsync();

            var row = (await _service.GetUsersAsync(1, 30, "t@test.com", "name", true)).Users.Single();

            Assert.Equal(2, row.TaskCount);
            Assert.Equal(1, row.CompletedTasks);
            Assert.Equal(25, row.FocusMinutes);
        }

        // ─── İstatistik ─────────────────────────────────────────────────────────

        [Fact]
        public async Task GetStatsAsync_ShouldCountUsersTasksAndFocus()
        {
            await SeedUserAsync(2, "t@test.com");
            _context.Tasks.Add(new TaskItem { UserId = 2, Title = "a", IsCompleted = true });
            _context.FocusSessions.Add(new FocusSession { UserId = 2, TaskName = "f", DurationMinutes = 30, Completed = true, StartedAt = DateTime.UtcNow });
            await _context.SaveChangesAsync();

            var stats = await _service.GetStatsAsync();

            Assert.Equal(1, stats.TotalUsers);
            Assert.Equal(1, stats.TotalTasks);
            Assert.Equal(1, stats.CompletedTasks);
            Assert.Equal(30, stats.TotalFocusMinutes);
            Assert.Equal(1, stats.ActiveToday);
            Assert.Equal(7, stats.DailyTrend.Count); // her zaman 7 günlük pencere
        }

        [Fact]
        public async Task GetStatsAsync_WeeklyComparison_SplitsLast7DaysFromPrevious7()
        {
            var now = DateTime.UtcNow;
            _context.Users.AddRange(
                new User { Id = 2, Email = "a@t.com", Name = "A", CreatedAt = now.AddDays(-2), LastActiveAt = now },
                new User { Id = 3, Email = "b@t.com", Name = "B", CreatedAt = now.AddDays(-10), LastActiveAt = now.AddDays(-3) },
                new User { Id = 4, Email = "c@t.com", Name = "C", CreatedAt = now.AddDays(-30), LastActiveAt = now.AddDays(-20) });
            _context.FocusSessions.AddRange(
                new FocusSession { UserId = 2, TaskName = "f", DurationMinutes = 40, Completed = true, StartedAt = now.AddDays(-1) },
                new FocusSession { UserId = 3, TaskName = "f", DurationMinutes = 25, Completed = true, StartedAt = now.AddDays(-9) },
                new FocusSession { UserId = 3, TaskName = "f", DurationMinutes = 10, Completed = false, StartedAt = now.AddDays(-9) }); // yarım kalanın süresi de odak
            await _context.SaveChangesAsync();

            var s = await _service.GetStatsAsync();

            Assert.Equal(1, s.SeenToday);
            Assert.Equal(2, s.Seen7d);
            Assert.Equal(1, s.NewUsers7d);
            Assert.Equal(1, s.NewUsersPrev7d);
            Assert.Equal(40, s.FocusMinutes7d);
            Assert.Equal(35, s.FocusMinutesPrev7d);
            // Gün etiketi istemcide biçimlenir: ISO tarih, bugün son sırada.
            Assert.Equal(now.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture), s.DailyTrend[^1].Date);
        }

        // ─── KVKK ihracı ────────────────────────────────────────────────────────

        [Fact]
        public async Task ExportUserAsync_ShouldReturnNull_WhenUserMissing()
        {
            Assert.Null(await _service.ExportUserAsync(999, _admin));
        }

        [Fact]
        public async Task ExportUserAsync_ShouldReturnAllUserDataAndAudit()
        {
            var user = await SeedUserAsync(2, "t@test.com");
            _context.Tasks.Add(new TaskItem { UserId = 2, Title = "a" });
            await _context.SaveChangesAsync();

            var export = await _service.ExportUserAsync(2, _admin);

            Assert.NotNull(export);
            Assert.Equal(user.Email, export!.Profile.Email);
            Assert.Single(export.Tasks);
            // İhraç denetlenebilir olmalı: kim, kimin verisini aldı.
            Assert.Equal("export", (await _context.AdminAuditLogs.SingleAsync()).Action);
        }

        [Fact]
        public async Task GetAuditLogAsync_ShouldClampTakeAndReturnNewestFirst()
        {
            await SeedUserAsync(2, "a@test.com");
            await SeedUserAsync(3, "b@test.com");
            await _service.SetRoleAsync(2, "Admin", _admin);
            await _service.SetRoleAsync(3, "Admin", _admin);

            // Sayfalamaya geçince kırpma sınırı değişti: limit artık [1, 200] aralığına
            // çekiliyor, yani 0 → 1. Eski API geçersiz değeri varsayılana çekiyordu.
            var (clamped, clampedTotal) = await _service.GetAuditLogPageAsync(0, 0);
            Assert.Single(clamped);
            Assert.Equal(2, clampedTotal); // sayfa 1 satır ama TOPLAM 2 — sayfalayıcı bunu gösterir

            var (logs, total) = await _service.GetAuditLogPageAsync(2, 0);
            Assert.Equal(2, logs.Count);
            Assert.Equal(2, total);
            Assert.True(logs[0].CreatedAt >= logs[1].CreatedAt);
        }
    }
}
