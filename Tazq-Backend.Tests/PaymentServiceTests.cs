using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// Madde 12 — ödeme başına para birimi ve ödeme GEÇMİŞİ. Eskiden yalnız "bu dönem
    /// ödendi mi" (LastPaidCycleKey) tutuluyordu: ay değişince geçen ayın ödemesi hiçbir
    /// yerde kalmıyor, "geçmiş ödemeler" gösterilemiyordu.
    /// </summary>
    public class PaymentServiceTests
    {
        private readonly AppDbContext _context;
        private readonly PaymentService _service;

        public PaymentServiceTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new AppDbContext(options);
            _service = new PaymentService(_context);
        }

        [Fact]
        public async Task Create_StoresNormalizedCurrency_AndRejectsUnknown()
        {
            var usd = await _service.CreatePaymentAsync(1, "Netflix", 20m, 5, PaymentRecurrence.Monthly, null, null, "usd");
            var bad = await _service.CreatePaymentAsync(1, "X", 1m, 5, PaymentRecurrence.Monthly, null, null, "BTC");
            var none = await _service.CreatePaymentAsync(1, "Kira", 200m, 1, PaymentRecurrence.Monthly, null, null);
            Assert.Equal("USD", usd!.Currency);
            Assert.Null(bad!.Currency);   // bilinmeyen birim → kullanıcının ana birimi
            Assert.Null(none!.Currency);
        }

        [Fact]
        public async Task MarkPaid_WritesHistoryRecord_WithSnapshot_AndIsIdempotentPerCycle()
        {
            var p = await _service.CreatePaymentAsync(1, "Netflix", 20m, 5, PaymentRecurrence.Monthly, null, null, "USD");
            await _service.MarkPaidAsync(1, p!.Id, "2026-10");
            await _service.MarkPaidAsync(1, p.Id, "2026-10"); // çift dokunuş
            var history = await _service.GetHistoryAsync(1, 6);
            var r = Assert.Single(history);
            Assert.Equal("Netflix", r.Title);
            Assert.Equal(20m, r.Amount);
            Assert.Equal("USD", r.Currency);
            Assert.Equal("2026-10", r.CycleKey);
        }

        [Fact]
        public async Task History_BackfillsPaidMarksMadeBeforeHistoryExisted()
        {
            // Geçmiş tablosundan önce "ödendi" denmiş ödeme: yalnız LastPaidCycleKey var.
            var cycle = DateTime.UtcNow.ToString("yyyy-MM");
            _context.Payments.Add(new Payment { UserId = 1, Title = "Elektrik", Amount = 850m, DueDay = 5, LastPaidCycleKey = cycle });
            await _context.SaveChangesAsync();

            var r = Assert.Single(await _service.GetHistoryAsync(1, 6));
            Assert.Equal("Elektrik", r.Title);
            Assert.Equal(cycle, r.CycleKey);
            Assert.Equal(cycle, r.PaidAt.ToString("yyyy-MM"));   // kendi ayına düşer
            Assert.True(r.PaidAt <= DateTime.UtcNow);
            Assert.Single(await _service.GetHistoryAsync(1, 6)); // ikinci çağrı çoğaltmaz
        }

        [Fact]
        public async Task UnmarkPaid_RemovesThatCyclesRecord()
        {
            var p = await _service.CreatePaymentAsync(1, "Kira", 200m, 1, PaymentRecurrence.Monthly, null, null);
            await _service.MarkPaidAsync(1, p!.Id, "2026-10");
            await _service.UnmarkPaidAsync(1, p.Id);
            Assert.Empty(await _service.GetHistoryAsync(1, 6));
        }

        [Fact]
        public async Task History_IsPerUser_NewestFirst_AndWithinWindow()
        {
            var a = await _service.CreatePaymentAsync(1, "A", 10m, 1, PaymentRecurrence.Monthly, null, null);
            var b = await _service.CreatePaymentAsync(2, "B", 99m, 1, PaymentRecurrence.Monthly, null, null);
            await _service.MarkPaidAsync(1, a!.Id, "2026-09");
            await _service.MarkPaidAsync(2, b!.Id, "2026-10");
            _context.PaymentRecords.Add(new PaymentRecord { UserId = 1, Title = "Eski", Amount = 5m, CycleKey = "2025-01", PaidAt = DateTime.UtcNow.AddMonths(-10) });
            await _context.SaveChangesAsync();
            await _service.MarkPaidAsync(1, a.Id, "2026-10");

            var history = await _service.GetHistoryAsync(1, 6);
            Assert.Equal(2, history.Count);                // başka kullanıcı ve pencere dışı yok
            Assert.True(history[0].PaidAt >= history[1].PaidAt);
        }

        [Fact]
        public async Task DeletingPayment_KeepsItsHistory()
        {
            var p = await _service.CreatePaymentAsync(1, "Spor salonu", 30m, 1, PaymentRecurrence.Monthly, null, null, "EUR");
            await _service.MarkPaidAsync(1, p!.Id, "2026-10");
            await _service.DeletePaymentAsync(1, p.Id);
            var r = Assert.Single(await _service.GetHistoryAsync(1, 6));
            Assert.Null(r.PaymentId);                     // bağ koptu, kayıt kaldı
            Assert.Equal("Spor salonu", r.Title);
        }
    }
}
