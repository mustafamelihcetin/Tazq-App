using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    /// <summary>2026-11-01 — destek fotoğrafları: tür baytlardan, sınırlar sunucuda, sahiplik ve saklama.</summary>
    public class SupportAttachmentTests
    {
        private static AppDbContext Db() => new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        private static byte[] Jpeg(int size) { var b = new byte[size]; b[0] = 0xFF; b[1] = 0xD8; b[2] = 0xFF; return b; }

        private static async Task<SupportMessage> Msg(AppDbContext db, int userId, DateTime? closedAt = null)
        {
            var m = new SupportMessage { UserId = userId, Message = "x", ClosedAt = closedAt };
            db.SupportMessages.Add(m); await db.SaveChangesAsync(); return m;
        }

        [Fact]
        public async Task Accepts_RealImage_RejectsFakeExtension()
        {
            var db = Db(); var m = await Msg(db, 1);
            Assert.Equal(SupportAttachments.AddResult.Ok, (await SupportAttachments.AddAsync(db, m.Id, 1, false, Jpeg(1000))).Result);
            var fake = System.Text.Encoding.UTF8.GetBytes("<html>not an image</html>");
            Assert.Equal(SupportAttachments.AddResult.BadType, (await SupportAttachments.AddAsync(db, m.Id, 1, false, fake)).Result);
        }

        [Fact]
        public async Task Limits_SizeConversationAndOwner()
        {
            var db = Db(); var m = await Msg(db, 1);
            Assert.Equal(SupportAttachments.AddResult.TooLarge, (await SupportAttachments.AddAsync(db, m.Id, 1, false, Jpeg(SupportAttachments.MaxBytes + 1))).Result);
            Assert.Equal(SupportAttachments.AddResult.NotFound, (await SupportAttachments.AddAsync(db, m.Id, 2, false, Jpeg(100))).Result); // başkasının konuşması
            for (var i = 0; i < SupportAttachments.MaxPerConversation; i++) await SupportAttachments.AddAsync(db, m.Id, 1, false, Jpeg(100));
            Assert.Equal(SupportAttachments.AddResult.ConversationFull, (await SupportAttachments.AddAsync(db, m.Id, 1, false, Jpeg(100))).Result);
        }

        [Fact]
        public async Task ClosedConversation_RejectsAndOldOnesArePurged()
        {
            var db = Db(); var open = await Msg(db, 1);
            await SupportAttachments.AddAsync(db, open.Id, 1, false, Jpeg(100));
            var closed = await Msg(db, 1, DateTime.UtcNow);
            Assert.Equal(SupportAttachments.AddResult.Closed, (await SupportAttachments.AddAsync(db, closed.Id, 1, false, Jpeg(100))).Result);
            open.ClosedAt = DateTime.UtcNow.AddDays(-(SupportAttachments.KeepDaysAfterClose + 1));
            db.Update(open); await db.SaveChangesAsync();
            Assert.Equal(1, await SupportAttachments.PurgeAsync(db, DateTime.UtcNow));
        }
    }
}
