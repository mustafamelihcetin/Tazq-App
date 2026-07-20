using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    public class AdminSignupDigestTests
    {
        private readonly AppDbContext _context;
        private static readonly DateOnly Day = new(2026, 7, 20);

        public AdminSignupDigestTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new AppDbContext(options);
        }

        private User Seed(string email, DateTime createdAt, bool verified = true, string? passwordHash = "hash", DateTime? deletedAt = null)
        {
            var user = new User
            {
                Name = "Kullanıcı " + email,
                Email = email,
                CreatedAt = createdAt,
                IsEmailVerified = verified,
                PasswordHash = passwordHash,
                PasswordSalt = "salt",
                DeletedAt = deletedAt,
                Role = "User"
            };
            _context.Users.Add(user);
            return user;
        }

        [Fact]
        public async Task CollectSignups_IncludesOnlyThatUtcDay()
        {
            // Pencere sınırları: 00:00 dahil, ertesi gün 00:00 hariç.
            Seed("onceki-gun@x.com", new DateTime(2026, 7, 19, 23, 59, 59, DateTimeKind.Utc));
            Seed("gun-basi@x.com", new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc));
            Seed("gun-sonu@x.com", new DateTime(2026, 7, 20, 23, 59, 59, DateTimeKind.Utc));
            Seed("ertesi-gun@x.com", new DateTime(2026, 7, 21, 0, 0, 0, DateTimeKind.Utc));
            await _context.SaveChangesAsync();

            var entries = await AdminSignupDigestService.CollectSignupsAsync(_context, Day);

            Assert.Equal(new[] { "gun-basi@x.com", "gun-sonu@x.com" }, entries.Select(e => e.Email));
        }

        [Fact]
        public async Task CollectSignups_ReturnsEmptyWhenNoSignups()
        {
            Seed("baska-gun@x.com", new DateTime(2026, 7, 18, 12, 0, 0, DateTimeKind.Utc));
            await _context.SaveChangesAsync();

            var entries = await AdminSignupDigestService.CollectSignupsAsync(_context, Day);

            Assert.Empty(entries);
        }

        [Fact]
        public async Task CollectSignups_IncludesSoftDeletedAndMarksProvider()
        {
            // Kaydolup aynı gün hesabını silen kullanıcı global filtreyle gizlenir;
            // özet bunu görmezse "kaydoldu ama hemen kaçtı" sinyali kaybolur.
            Seed("silen@x.com", new DateTime(2026, 7, 20, 8, 0, 0, DateTimeKind.Utc),
                deletedAt: new DateTime(2026, 7, 20, 9, 0, 0, DateTimeKind.Utc));
            Seed("sosyal@x.com", new DateTime(2026, 7, 20, 10, 0, 0, DateTimeKind.Utc), passwordHash: "");
            Seed("bekleyen@x.com", new DateTime(2026, 7, 20, 11, 0, 0, DateTimeKind.Utc), verified: false);
            await _context.SaveChangesAsync();

            var entries = await AdminSignupDigestService.CollectSignupsAsync(_context, Day);

            Assert.Equal(3, entries.Count);
            Assert.Equal("e-posta · silindi", entries[0].Provider);
            Assert.Equal("sosyal", entries[1].Provider);
            Assert.False(entries[2].IsEmailVerified);
        }
    }
}
