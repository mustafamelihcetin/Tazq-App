using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    public class SupportServiceTests
    {
        private readonly AppDbContext _context;
        private readonly SupportService _service;

        public SupportServiceTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new AppDbContext(options);
            _service = new SupportService(_context);
        }

        private async Task<User> SeedUserAsync(string email = "u@test.com")
        {
            var user = new User { Email = email, Name = "Test User", Role = "User" };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            return user;
        }

        [Fact]
        public async Task ReportCrashAsync_ShouldAttachUserEmail_WhenAuthenticated()
        {
            var user = await SeedUserAsync("crash@test.com");

            var crash = await _service.ReportCrashAsync(new ClientCrash { ErrorMessage = "boom" }, user.Id);

            // Çökme hesaba bağlanmalı — triyaj buna dayanıyor.
            Assert.Equal(user.Id, crash.UserId);
            Assert.Equal("crash@test.com", crash.UserEmail);
        }

        [Fact]
        public async Task ReportCrashAsync_ShouldPersist_WhenAnonymous()
        {
            var crash = await _service.ReportCrashAsync(new ClientCrash { ErrorMessage = "boom" }, null);

            // Anonim çökme de kaydedilmeli (AllowAnonymous endpoint).
            Assert.Null(crash.UserId);
            Assert.Equal(1, await _context.ClientCrashes.CountAsync());
        }

        [Fact]
        public async Task GetCrashesAsync_ShouldReturnNewestFirst_AndRespectLimit()
        {
            for (int i = 0; i < 5; i++)
            {
                _context.ClientCrashes.Add(new ClientCrash
                {
                    ErrorMessage = $"e{i}",
                    CreatedAt = DateTime.UtcNow.AddMinutes(i), // i=4 en yeni
                });
            }
            await _context.SaveChangesAsync();

            var crashes = await _service.GetCrashesAsync(2);

            Assert.Equal(2, crashes.Count);
            Assert.Equal("e4", crashes[0].ErrorMessage);
            Assert.Equal("e3", crashes[1].ErrorMessage);
        }

        [Fact]
        public async Task ResolveCrashAsync_ShouldMarkResolved_AndReturnFalseWhenMissing()
        {
            var crash = await _service.ReportCrashAsync(new ClientCrash { ErrorMessage = "x" }, null);

            Assert.True(await _service.ResolveCrashAsync(crash.Id));
            Assert.True((await _context.ClientCrashes.FindAsync(crash.Id))!.IsResolved);
            Assert.False(await _service.ResolveCrashAsync(99999));
        }

        [Fact]
        public async Task CreateMessageAsync_ShouldTrimAndSnapshotUserIdentity()
        {
            var user = await SeedUserAsync();

            var msg = await _service.CreateMessageAsync(user.Id, "   yardım lazım   ");

            Assert.NotNull(msg);
            Assert.Equal("yardım lazım", msg!.Message);
            Assert.Equal(user.Email, msg.UserEmail);
            Assert.False(msg.IsRead);
        }

        [Fact]
        public async Task CreateMessageAsync_ShouldReturnNull_WhenUserMissing()
        {
            Assert.Null(await _service.CreateMessageAsync(99999, "merhaba"));
        }

        [Fact]
        public async Task GetMessagesForUserAsync_ShouldOnlyReturnOwnMessages()
        {
            var mine = await SeedUserAsync("mine@test.com");
            var other = await SeedUserAsync("other@test.com");
            await _service.CreateMessageAsync(mine.Id, "benim");
            await _service.CreateMessageAsync(other.Id, "başkasının");

            var messages = await _service.GetMessagesForUserAsync(mine.Id);

            // Yetkilendirme sınırı: kullanıcı yalnız kendi mesajlarını görmeli.
            Assert.Single(messages);
            Assert.Equal("benim", messages[0].Message);
        }

        [Fact]
        public async Task ReplyAsync_ShouldSetReplyAndMarkRead()
        {
            var user = await SeedUserAsync();
            var msg = await _service.CreateMessageAsync(user.Id, "soru");

            var replied = await _service.ReplyAsync(msg!.Id, "  cevap  ");

            Assert.NotNull(replied);
            Assert.Equal("cevap", replied!.AdminReply);
            Assert.NotNull(replied.RepliedAt);
            Assert.True(replied.IsRead); // Yanıtlanan mesaj okunmuş sayılır.
        }

        [Fact]
        public async Task ReplyAsync_ShouldReturnNull_WhenMessageMissing()
        {
            Assert.Null(await _service.ReplyAsync(99999, "cevap"));
        }

        [Fact]
        public async Task MarkAsReadAsync_And_DeleteMessageAsync_ShouldReportMissing()
        {
            var user = await SeedUserAsync();
            var msg = await _service.CreateMessageAsync(user.Id, "soru");

            Assert.True(await _service.MarkAsReadAsync(msg!.Id));
            Assert.False(await _service.MarkAsReadAsync(99999));

            Assert.True(await _service.DeleteMessageAsync(msg.Id));
            Assert.Equal(0, await _context.SupportMessages.CountAsync());
            Assert.False(await _service.DeleteMessageAsync(msg.Id)); // ikinci silme no-op
        }
    }
}
