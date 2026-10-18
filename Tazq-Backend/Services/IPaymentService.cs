using Tazq_App.Models;

namespace Tazq_App.Services
{
    public interface IPaymentService
    {
        Task<List<Payment>> GetPaymentsAsync(int userId);
        Task<Payment?> CreatePaymentAsync(int userId, string title, decimal amount, int dueDay, PaymentRecurrence recurrence, DateTime? nextDueDate, string? category);
        Task<Payment?> UpdatePaymentAsync(int userId, int paymentId, string title, decimal amount, int dueDay, PaymentRecurrence recurrence, DateTime? nextDueDate, string? category);
        Task<bool> DeletePaymentAsync(int userId, int paymentId);
        Task<Payment?> MarkPaidAsync(int userId, int paymentId, string cycleKey);
        Task<Payment?> UnmarkPaidAsync(int userId, int paymentId);
    }
}
