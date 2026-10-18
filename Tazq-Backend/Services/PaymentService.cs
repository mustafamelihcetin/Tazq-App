using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    public class PaymentService : IPaymentService
    {
        private readonly AppDbContext _db;

        // TaskService.MaxActiveTasksPerUser (200) ile aynı mantık — bir kullanıcı ödeme
        // listesini sınırsız büyütemez. Gerçek bir hanenin aylık ödeme sayısı bunun çok
        // altında; sınır kötüye kullanıma karşı, normal kullanımı etkilemez.
        private const int MaxPaymentsPerUser = 100;
        private const int MaxTitleLength = 100;
        private const int MaxCategoryLength = 40;

        public PaymentService(AppDbContext db)
        {
            _db = db;
        }

        private static string Clamp(string value, int max) =>
            string.IsNullOrEmpty(value) ? string.Empty : (value.Length <= max ? value : value[..max]);

        public async Task<List<Payment>> GetPaymentsAsync(int userId)
        {
            return await _db.Payments
                .AsNoTracking()
                .Where(p => p.UserId == userId)
                .OrderBy(p => p.DueDay)
                .ToListAsync();
        }

        public async Task<Payment?> CreatePaymentAsync(int userId, string title, decimal amount, int dueDay, PaymentRecurrence recurrence, DateTime? nextDueDate, string? category)
        {
            var count = await _db.Payments.CountAsync(p => p.UserId == userId);
            if (count >= MaxPaymentsPerUser)
                throw new InvalidOperationException($"PAYMENT_LIMIT_REACHED:{MaxPaymentsPerUser}");

            var payment = new Payment
            {
                UserId = userId,
                Title = Clamp((title ?? string.Empty).Trim(), MaxTitleLength),
                Amount = amount,
                DueDay = Math.Clamp(dueDay, 1, 31),
                Recurrence = recurrence,
                NextDueDate = nextDueDate,
                Category = category == null ? null : Clamp(category.Trim(), MaxCategoryLength),
            };
            _db.Payments.Add(payment);
            await _db.SaveChangesAsync();
            return payment;
        }

        public async Task<Payment?> UpdatePaymentAsync(int userId, int paymentId, string title, decimal amount, int dueDay, PaymentRecurrence recurrence, DateTime? nextDueDate, string? category)
        {
            var payment = await _db.Payments.FirstOrDefaultAsync(p => p.Id == paymentId && p.UserId == userId);
            if (payment == null) return null;

            payment.Title = Clamp((title ?? string.Empty).Trim(), MaxTitleLength);
            payment.Amount = amount;
            payment.DueDay = Math.Clamp(dueDay, 1, 31);
            payment.Recurrence = recurrence;
            payment.NextDueDate = nextDueDate;
            payment.Category = category == null ? null : Clamp(category.Trim(), MaxCategoryLength);
            await _db.SaveChangesAsync();
            return payment;
        }

        public async Task<bool> DeletePaymentAsync(int userId, int paymentId)
        {
            var payment = await _db.Payments.FirstOrDefaultAsync(p => p.Id == paymentId && p.UserId == userId);
            if (payment == null) return false;

            _db.Payments.Remove(payment);
            return await _db.SaveChangesAsync() > 0;
        }

        public async Task<Payment?> MarkPaidAsync(int userId, int paymentId, string cycleKey)
        {
            var payment = await _db.Payments.FirstOrDefaultAsync(p => p.Id == paymentId && p.UserId == userId);
            if (payment == null) return null;

            payment.LastPaidCycleKey = Clamp(cycleKey, 16);
            await _db.SaveChangesAsync();
            return payment;
        }

        // "Geri al" tostu için — MarkPaidAsync'in tersi, aynı kullanıcı/kayıt kısıtı.
        public async Task<Payment?> UnmarkPaidAsync(int userId, int paymentId)
        {
            var payment = await _db.Payments.FirstOrDefaultAsync(p => p.Id == paymentId && p.UserId == userId);
            if (payment == null) return null;

            payment.LastPaidCycleKey = null;
            await _db.SaveChangesAsync();
            return payment;
        }
    }
}
