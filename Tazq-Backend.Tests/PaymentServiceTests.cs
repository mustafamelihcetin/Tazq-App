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
        public async Task Skip_ClosesCycle_WithoutHistory_EvenAfterBackfill()
        {
            var p = await _service.CreatePaymentAsync(1, "Elektrik", 850m, 5, PaymentRecurrence.Monthly, null, null);
            var skipped = await _service.SkipCycleAsync(1, p!.Id, "2026-10");
            Assert.Equal("2026-10", skipped!.LastPaidCycleKey);
            Assert.Equal("2026-10", skipped.LastSkippedCycleKey);
            Assert.Equal(850m, skipped.Amount);
            Assert.Empty(await _service.GetHistoryAsync(1, 24));
        }

        [Fact]
        public async Task MarkPaid_AfterSkip_CountsAsPaid()
        {
            var p = await _service.CreatePaymentAsync(1, "Elektrik", 850m, 5, PaymentRecurrence.Monthly, null, null);
            await _service.SkipCycleAsync(1, p!.Id, "2026-10");
            var paid = await _service.MarkPaidAsync(1, p.Id, "2026-10");
            Assert.Null(paid!.LastSkippedCycleKey);
            Assert.Single(await _service.GetHistoryAsync(1, 24));
        }

        [Fact]
        public async Task Skip_OtherUsersPayment_ReturnsNull()
        {
            var p = await _service.CreatePaymentAsync(1, "Kira", 100m, 5, PaymentRecurrence.Monthly, null, null);
            Assert.Null(await _service.SkipCycleAsync(2, p!.Id, "2026-10"));
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

        // ── 2026-11-01: değişken tutar + taksit ─────────────────────────────────

        [Fact]
        public async Task VariableAmount_MarkPaidWritesActual_AndBecomesNextEstimate()
        {
            var p = await _service.CreatePaymentAsync(1, "Elektrik", 600m, 15, PaymentRecurrence.Monthly, null, null, null, isVariable: true);
            await _service.MarkPaidAsync(1, p!.Id, "2026-10", 742.5m);
            var r = Assert.Single(await _service.GetHistoryAsync(1, 6));
            Assert.Equal(742.5m, r.Amount);                       // geçmişe GERÇEK tutar
            Assert.Equal(742.5m, (await _context.Payments.FindAsync(p.Id))!.Amount); // sonraki tahmin
        }

        [Fact]
        public async Task FixedAmount_ActualAmountGoesToHistory_ButPlanStays()
        {
            var p = await _service.CreatePaymentAsync(1, "Kira", 200m, 1, PaymentRecurrence.Monthly, null, null);
            await _service.MarkPaidAsync(1, p!.Id, "2026-10", 210m);
            Assert.Equal(210m, Assert.Single(await _service.GetHistoryAsync(1, 6)).Amount);
            Assert.Equal(200m, (await _context.Payments.FindAsync(p.Id))!.Amount);
        }

        [Fact]
        public async Task Installment_ValidatedAndClamped_InvalidIsIgnored()
        {
            var ok = await _service.CreatePaymentAsync(1, "Telefon", 1000m, 10, PaymentRecurrence.Monthly, null, null, null, installmentCount: 500, installmentStart: "2026-11");
            Assert.Equal(120, ok!.InstallmentCount);
            Assert.Equal("2026-11", ok.InstallmentStart);
            var badStart = await _service.CreatePaymentAsync(1, "X", 1m, 10, PaymentRecurrence.Monthly, null, null, null, installmentCount: 6, installmentStart: "2026-13");
            Assert.Null(badStart!.InstallmentCount);
            var once = await _service.CreatePaymentAsync(1, "Y", 1m, 10, PaymentRecurrence.Once, null, null, null, installmentCount: 6, installmentStart: "2026-11");
            Assert.Null(once!.InstallmentCount); // tek seferlikte taksit anlamsız
        }
    }
}
