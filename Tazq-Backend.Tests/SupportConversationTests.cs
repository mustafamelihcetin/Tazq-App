using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;
using Xunit;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// Destek = konuşma (2026-10-31): kullanıcı yanıta yanıt verebilir, iki taraf da kapatabilir,
    /// eski tek yanıt konuşmadan düşmez, kullanıcı ekibi beklemeden kutuyu dolduramaz.
    /// Çökme kayıtları: hata başına grup + saklama süresi.
    /// </summary>
    public class SupportConversationTests
    {
        private readonly AppDbContext _db = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        private SupportService Svc => new(_db);

        private async Task<(User user, SupportMessage msg)> SeedAsync()
        {
            var u = new User { Email = "u@test.com", Name = "U" };
            _db.Users.Add(u); await _db.SaveChangesAsync();
            var m = await Svc.CreateMessageAsync(u.Id, "Merhaba, senkron çalışmıyor");
            return (u, m!);
        }

        [Fact]
        public async Task KullaniciEkipYanitindanSonraYazabilir_KutudaYenidenYeniOlur()
        {
            var (u, m) = await SeedAsync();
            await Svc.ReplyAsync(m.Id, "Sürümünü güncelleyebilir misin?", staffUserId: 99);
            var (outcome, after) = await Svc.UserReplyAsync(u.Id, m.Id, "Güncelledim, hâlâ aynı");

            Assert.Equal(UserReplyOutcome.Ok, outcome);
            var thread = SupportService.ThreadOf(after!);
            Assert.Equal(new[] { false, true, false }, thread.Select(e => e.FromStaff));
            Assert.False(after!.IsRead);
            Assert.NotNull(after.LastActivityAt);
        }

        [Fact]
        public async Task IkinciEkipYanitiBirincininUstuneYazmaz_EskiAlanSonYanitiTasir()
        {
            var (_, m) = await SeedAsync();
            await Svc.ReplyAsync(m.Id, "Birinci");
            var after = await Svc.ReplyAsync(m.Id, "İkinci");
            var thread = SupportService.ThreadOf(after!);
            Assert.Equal(new[] { "Birinci", "İkinci" }, thread.Where(e => e.FromStaff).Select(e => e.Body));
            Assert.Equal("İkinci", after!.AdminReply); // eski uygulama sürümleri son yanıtı okur
        }

        [Fact]
        public async Task EskiTekYanitKonusmadanDusmez()
        {
            var (u, m) = await SeedAsync();
            // Yeni sistemden ÖNCE yazılmış yanıt: yalnız AdminReply alanında.
            var legacy = await _db.SupportMessages.FindAsync(m.Id);
            legacy!.AdminReply = "Eski yanıt"; legacy.RepliedAt = DateTime.UtcNow.AddDays(-1);
            await _db.SaveChangesAsync();

            await Svc.UserReplyAsync(u.Id, m.Id, "Teşekkürler ama bir sorum daha var");
            var after = await Svc.ReplyAsync(m.Id, "Buyur");
            var bodies = SupportService.ThreadOf(after!).Select(e => e.Body).ToList();
            Assert.Equal(new[] { "Merhaba, senkron çalışmıyor", "Eski yanıt", "Teşekkürler ama bir sorum daha var", "Buyur" }, bodies);
        }

        [Fact]
        public async Task EkipYanitlamadanUcMesajdanSonraBekletir()
        {
            var (u, m) = await SeedAsync();
            Assert.Equal(UserReplyOutcome.Ok, (await Svc.UserReplyAsync(u.Id, m.Id, "2")).Outcome);
            Assert.Equal(UserReplyOutcome.Ok, (await Svc.UserReplyAsync(u.Id, m.Id, "3")).Outcome);
            Assert.Equal(UserReplyOutcome.WaitForStaff, (await Svc.UserReplyAsync(u.Id, m.Id, "4")).Outcome);
            await Svc.ReplyAsync(m.Id, "Buradayım");
            Assert.Equal(UserReplyOutcome.Ok, (await Svc.UserReplyAsync(u.Id, m.Id, "5")).Outcome);
        }

        [Fact]
        public async Task BaskasininKonusmasinaYazilamazKapatilamaz()
        {
            var (_, m) = await SeedAsync();
            Assert.Equal(UserReplyOutcome.NotFound, (await Svc.UserReplyAsync(12345, m.Id, "x")).Outcome);
            Assert.False(await Svc.CloseAsync(m.Id, byStaff: false, userId: 12345));
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public async Task IkiTarafDaKapatabilir_KapaliKonusmayaYazilmaz(bool byStaff)
        {
            var (u, m) = await SeedAsync();
            Assert.True(await Svc.CloseAsync(m.Id, byStaff, byStaff ? null : u.Id));
            var closed = await _db.SupportMessages.FindAsync(m.Id);
            Assert.Equal(byStaff ? "staff" : "user", closed!.ClosedBy);
            Assert.Equal(UserReplyOutcome.Closed, (await Svc.UserReplyAsync(u.Id, m.Id, "x")).Outcome);
            Assert.Null(await Svc.ReplyAsync(m.Id, "x"));
            Assert.False(SupportService.CanUserReply(closed));
        }

        // ── Çökme kayıtları ─────────────────────────────────────────────────

        private void Crash(string msg, int daysAgo, bool resolved = false) =>
            _db.ClientCrashes.Add(new ClientCrash { ErrorMessage = msg, CreatedAt = DateTime.UtcNow.AddDays(-daysAgo), IsResolved = resolved });

        [Fact]
        public async Task AyniHataTekGrup_CozulduButunGrubuKapatir()
        {
            Crash("A", 1); Crash("A", 2); Crash("A", 3, resolved: true); Crash("B", 5);
            await _db.SaveChangesAsync();

            var (groups, total, latest) = await CrashLog.GroupsPageAsync(_db, 15, 0, unresolvedOnly: false);
            Assert.Equal(2, total);
            Assert.Equal("A", groups[0].ErrorMessage); // en son görülen önde
            Assert.Equal(3, groups[0].Count);
            Assert.Equal(2, groups[0].Unresolved);
            Assert.Equal(2, latest.Count);

            Assert.Equal(2, await CrashLog.ResolveGroupAsync(_db, "A"));
            var (open, openTotal, _) = await CrashLog.GroupsPageAsync(_db, 15, 0, unresolvedOnly: true);
            Assert.Equal(1, openTotal);
            Assert.Equal("B", open.Single().ErrorMessage);
        }

        [Fact]
        public async Task Saklama_Cozulmus30Gun_Hepsi90Gun()
        {
            Crash("cozulmus-yeni", 10, resolved: true);   // kalır
            Crash("cozulmus-eski", 31, resolved: true);   // gider
            Crash("acik-60", 60);                         // kalır (açık, 90'dan genç)
            Crash("acik-91", 91);                         // gider
            await _db.SaveChangesAsync();

            Assert.Equal(2, await CrashLog.PurgeAsync(_db, DateTime.UtcNow));
            Assert.Equal(new[] { "acik-60", "cozulmus-yeni" }, _db.ClientCrashes.Select(c => c.ErrorMessage).OrderBy(x => x).ToArray());
        }
    }
}
