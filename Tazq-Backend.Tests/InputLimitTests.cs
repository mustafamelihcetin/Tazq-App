using Microsoft.EntityFrameworkCore;
using Moq;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// Sınırsız kalmış girdi alanlarının artık bağlı olduğunu sabitler.
    ///
    /// Bu testlerin varlık sebebi, sınırın KENDİSİ kadar sınırın SESSİZ olması:
    /// hiçbiri istek reddetmiyor, hepsi kırpıyor. Kırpma bir gün kazara kaldırılırsa
    /// hiçbir hata çıkmaz, sadece tavan yok olur — yakalayacak tek şey bu testler.
    /// </summary>
    public class InputLimitTests
    {
        private static AppDbContext NewContext() =>
            new(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

        // ── Odak oturumu ────────────────────────────────────────────────────

        [Fact]
        public async Task SaveSession_ShouldClampTaskName()
        {
            var service = new FocusSessionService(NewContext());

            var session = await service.SaveSessionAsync(1, new string('x', 5_000), 25, true);

            Assert.Equal(200, session.TaskName.Length);
        }

        [Fact]
        public async Task SaveSession_ShouldClampAbsurdDuration()
        {
            var service = new FocusSessionService(NewContext());

            // Tek istekle toplam odak süresini sonsuza taşıma denemesi.
            var session = await service.SaveSessionAsync(1, "Focus", int.MaxValue, true);

            Assert.Equal(24 * 60, session.DurationMinutes);
        }

        [Fact]
        public async Task SaveSession_ShouldRejectNegativeDuration()
        {
            var service = new FocusSessionService(NewContext());

            // Negatif süre, toplamı AŞAĞI çekerek geçmiş gerçek oturumları gizlerdi.
            var session = await service.SaveSessionAsync(1, "Focus", -600, true);

            Assert.Equal(0, session.DurationMinutes);
        }

        [Fact]
        public async Task SaveSession_ShouldLeaveNormalValuesUntouched()
        {
            var service = new FocusSessionService(NewContext());

            var session = await service.SaveSessionAsync(1, "Derin çalışma", 25, true);

            Assert.Equal("Derin çalışma", session.TaskName);
            Assert.Equal(25, session.DurationMinutes);
        }

        // ── Destek mesajları ────────────────────────────────────────────────

        [Fact]
        public async Task CreateMessage_ShouldClampMessage()
        {
            var context = NewContext();
            var user = new User { Email = "u@test.com", Name = "Test", Role = "User" };
            context.Users.Add(user);
            await context.SaveChangesAsync();

            var service = new SupportService(context);
            var msg = await service.CreateMessageAsync(user.Id, new string('a', 50_000));

            Assert.NotNull(msg);
            Assert.Equal(2_000, msg!.Message.Length);
        }

        [Fact]
        public async Task ReplyAsync_ShouldClampReply()
        {
            var context = NewContext();
            var user = new User { Email = "u@test.com", Name = "Test", Role = "User" };
            context.Users.Add(user);
            await context.SaveChangesAsync();

            var service = new SupportService(context);
            var msg = await service.CreateMessageAsync(user.Id, "yardım");
            var replied = await service.ReplyAsync(msg!.Id, new string('b', 50_000));

            Assert.NotNull(replied);
            Assert.Equal(4_000, replied!.AdminReply!.Length);
        }

        // ── Görev sayfalama ─────────────────────────────────────────────────

        /// <summary>
        /// Şifreleme kimlik fonksiyonu — bu testlerin konusu sayfalama, kripto değil
        /// (aynı desen TaskQuotaTests'te de kullanılıyor).
        /// </summary>
        private static TaskService NewTaskService(AppDbContext context)
        {
            var key = new byte[32];
            var cryptoMock = new Mock<ICryptoService>();
            cryptoMock.Setup(c => c.Encrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
                .Returns((string val, byte[] k) => val ?? string.Empty);
            cryptoMock.Setup(c => c.Decrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
                .Returns((string val, byte[] k) => val ?? string.Empty);
            cryptoMock.Setup(c => c.GetKeyForUser(It.IsAny<int>())).Returns(key);
            cryptoMock.Setup(c => c.GetLegacyKeysForUser(It.IsAny<int>())).Returns(Array.Empty<byte[]>());
            cryptoMock.Setup(c => c.ComputeBlindIndex(It.IsAny<string>(), It.IsAny<byte[]>()))
                .Returns((string val, byte[] k) => val?.ToLowerInvariant() ?? string.Empty);

            return new TaskService(
                context,
                cryptoMock.Object,
                new Mock<Microsoft.Extensions.Logging.ILogger<TaskService>>().Object);
        }

        // Kotayı (200 aktif görev) devreye sokmadan doğrudan tohumla — konu sayfalama.
        private static void SeedTasks(AppDbContext context, int userId, int count)
        {
            for (int i = 0; i < count; i++)
                context.Tasks.Add(new TaskItem { UserId = userId, Title = $"t{i}", Description = string.Empty });
            context.SaveChanges();
        }

        [Fact]
        public async Task GetTasks_ShouldCapPageSize()
        {
            var context = NewContext();
            var service = NewTaskService(context);
            SeedTasks(context, userId: 1, count: 250);

            // İstemci 100000 istese bile tavan 200: tek istekte tüm kasa boşaltılamaz.
            var (items, total) = await service.GetTasksAsync(1, null, null, null, null, null, null, 1, 100_000);

            Assert.Equal(200, items.Count);
            Assert.Equal(250, total);
        }

        [Fact]
        public async Task GetTasks_ShouldAllowClientPageSizeUnchanged()
        {
            var context = NewContext();
            var service = NewTaskService(context);
            SeedTasks(context, userId: 1, count: 250);

            // REGRESYON FRENİ: mağazadaki istemci tam olarak 200 gönderiyor ve dönen
            // sayı 200'ün ALTINA düşerse döngüsünü "son sayfa" sanıp bitiriyor. Tavan
            // 200'ün altına çekilirse bu test kırmızıya döner — ve o değişiklik
            // kullanıcıların görevlerini uygulamadan kaybettirirdi.
            var (items, _) = await service.GetTasksAsync(1, null, null, null, null, null, null, 1, 200);

            Assert.Equal(200, items.Count);
        }

        [Fact]
        public async Task GetTasks_ShouldNormalizeNonPositivePage()
        {
            var context = NewContext();
            var service = NewTaskService(context);
            SeedTasks(context, userId: 1, count: 1);

            // page=0 → Skip(-pageSize) → PostgreSQL'de negatif OFFSET → 500.
            // Artık ilk sayfaya normalize ediliyor, istisna fırlatmıyor.
            var (items, _) = await service.GetTasksAsync(1, null, null, null, null, null, null, 0, 50);

            Assert.Single(items);
        }
    }
}
