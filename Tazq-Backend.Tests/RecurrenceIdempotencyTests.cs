using Microsoft.EntityFrameworkCore;
using Moq;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// AYNI GÖREV İKİ KEZ OLUŞMAZ.
    ///
    /// Canlı veride aynı aylık görevin ardışık numaralı İKİZLERİ bulundu ("her ayın 27'si"
    /// görevinin iki kopyası, ikisi de aynı gün). İki yol vardı:
    ///  1. Tekrarlı görev tamamla → geri al → tamamla: her tamamlamada bir SONRAKİ örnek
    ///     yeniden üretiliyordu.
    ///  2. İstemci anahtarsız gönderiyordu; zaman aşımı sonrası kuyruk aynı görevi ikinci
    ///     kez oluşturuyordu. (İstemci artık her görevi anahtarla gönderiyor; burada
    ///     sunucunun o anahtarı gerçekten koruduğu sabitleniyor.)
    /// </summary>
    public class RecurrenceIdempotencyTests
    {
        private readonly AppDbContext _context;
        private readonly TaskService _service;

        public RecurrenceIdempotencyTests()
        {
            _context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
            var crypto = new Mock<ICryptoService>();
            crypto.Setup(c => c.Encrypt(It.IsAny<string>(), It.IsAny<byte[]>())).Returns((string v, byte[] _) => v ?? string.Empty);
            crypto.Setup(c => c.Decrypt(It.IsAny<string>(), It.IsAny<byte[]>())).Returns((string v, byte[] _) => v ?? string.Empty);
            crypto.Setup(c => c.GetKeyForUser(It.IsAny<int>())).Returns(new byte[32]);
            crypto.Setup(c => c.ComputeBlindIndex(It.IsAny<string>(), It.IsAny<byte[]>())).Returns((string v, byte[] _) => v?.ToLowerInvariant() ?? string.Empty);
            _service = new TaskService(_context, crypto.Object, new Mock<Microsoft.Extensions.Logging.ILogger<TaskService>>().Object);
        }

        private async Task<TaskItem> MonthlyTask() =>
            await _service.CreateTaskAsync(1, new TaskItem
            {
                Title = "Banka ödemesi",
                Description = string.Empty,
                DueDate = new DateTime(2026, 8, 27, 0, 0, 0, DateTimeKind.Utc),
                Recurrence = RecurrenceType.Monthly,
            });

        private Task<TaskItem?> SetCompleted(TaskItem t, bool done) =>
            _service.UpdateTaskAsync(1, t.Id, new TaskItem
            {
                Title = t.Title, Description = t.Description, DueDate = t.DueDate,
                Recurrence = t.Recurrence, IsCompleted = done,
            });

        private int CountOn(DateTime day) =>
            _context.Tasks.Count(x => x.UserId == 1 && x.DueDate != null && x.DueDate.Value.Date == day.Date);

        [Fact]
        public async Task CompletingCreatesNextMonth()
        {
            var t = await MonthlyTask();
            await SetCompleted(t, true);
            Assert.Equal(1, CountOn(new DateTime(2026, 9, 27)));
        }

        [Fact]
        public async Task CompleteUndoComplete_DoesNotDuplicateNextMonth()
        {
            // Kusurun ta kendisi: her tamamlama yeni bir 27 Eylül üretiyordu.
            var t = await MonthlyTask();
            await SetCompleted(t, true);
            await SetCompleted(t, false);
            await SetCompleted(t, true);
            Assert.Equal(1, CountOn(new DateTime(2026, 9, 27)));
        }

        [Fact]
        public async Task SameClientKey_CreatesOnce()
        {
            // İstemcinin zaman aşımı sonrası kuyruktan aynı görevi tekrar göndermesi.
            TaskItem Make() => new() { Title = "Kira", Description = string.Empty, ClientKey = "u-abc-123" };
            var first = await _service.CreateTaskAsync(1, Make());
            var retry = await _service.CreateTaskAsync(1, Make());
            Assert.Equal(first.Id, retry.Id);
            Assert.Equal(1, _context.Tasks.Count(x => x.UserId == 1));
        }
    }
}
