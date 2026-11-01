using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// 2026-11-01 — ödeme başlıkları ve odak seansı görev adları ŞİFRELİ saklanır. Görev başlığı zaten şifreliydi;
    /// aynı ad odak kaydında ve "kira/kredi kartı" gibi başlıklar ödemelerde düz duruyordu.
    /// Eski (şifreleme öncesi) düz kayıtlar okunmaya devam eder.
    /// </summary>
    public class EncryptionAtRestTests
    {
        private readonly AppDbContext _db;
        private readonly CryptoService _crypto = new("test-secret-key-1234567890123456");

        public EncryptionAtRestTests()
        {
            _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        }

        [Fact]
        public async Task PaymentTitle_EncryptedAtRest_PlainToUser()
        {
            var svc = new PaymentService(_db, _crypto);
            var created = await svc.CreatePaymentAsync(1, "Kredi kartı", 500m, 10, PaymentRecurrence.Monthly, null, null);
            Assert.Equal("Kredi kartı", created!.Title);                         // yanıt düz
            var raw = await _db.Payments.AsNoTracking().FirstAsync(p => p.Id == created.Id);
            Assert.NotEqual("Kredi kartı", raw.Title);                            // veritabanında şifreli
            Assert.Equal("Kredi kartı", Assert.Single(await svc.GetPaymentsAsync(1)).Title);

            await svc.MarkPaidAsync(1, created.Id, "2026-11");
            var rec = await _db.PaymentRecords.AsNoTracking().FirstAsync();
            Assert.NotEqual("Kredi kartı", rec.Title);                            // geçmiş de şifreli
            Assert.Equal("Kredi kartı", Assert.Single(await svc.GetHistoryAsync(1, 6)).Title);
        }

        [Fact]
        public async Task LegacyPlainPaymentTitle_StillReadable()
        {
            _db.Payments.Add(new Payment { UserId = 2, Title = "Kira", Amount = 100m, DueDay = 1 });
            await _db.SaveChangesAsync();
            var svc = new PaymentService(_db, _crypto);
            Assert.Equal("Kira", Assert.Single(await svc.GetPaymentsAsync(2)).Title);
        }

        [Fact]
        public async Task ReturnedPayment_DoesNotWritePlainBack()
        {
            var svc = new PaymentService(_db, _crypto);
            var p = await svc.CreatePaymentAsync(3, "Elektrik", 600m, 15, PaymentRecurrence.Monthly, null, null);
            await _db.SaveChangesAsync(); // aynı bağlamda ikinci kayıt düz metni yazmamalı
            var raw = await _db.Payments.AsNoTracking().FirstAsync(x => x.Id == p!.Id);
            Assert.NotEqual("Elektrik", raw.Title);
        }

        [Fact]
        public async Task FocusTaskName_EncryptedAtRest()
        {
            var svc = new FocusSessionService(_db, _crypto);
            var s = await svc.SaveSessionAsync(4, "Türev tekrarı", 25, true);
            var raw = await _db.FocusSessions.AsNoTracking().FirstAsync(x => x.Id == s.Id);
            Assert.NotEqual("Türev tekrarı", raw.TaskName);
            Assert.Equal("Türev tekrarı", _crypto.Decrypt(raw.TaskName, _crypto.GetKeyForUser(4)));
        }
    }
}
