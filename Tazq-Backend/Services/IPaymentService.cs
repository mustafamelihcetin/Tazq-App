using Tazq_App.Models;

namespace Tazq_App.Services
{
    public interface IPaymentService
    {
        Task<List<Payment>> GetPaymentsAsync(int userId);
        Task<Payment?> CreatePaymentAsync(int userId, string title, decimal amount, int dueDay, PaymentRecurrence recurrence, DateTime? nextDueDate, string? category, string? currency = null, bool isVariable = false, int? installmentCount = null, string? installmentStart = null, string? icon = null, string? color = null, int? reminderDays = null);
        Task<Payment?> UpdatePaymentAsync(int userId, int paymentId, string title, decimal amount, int dueDay, PaymentRecurrence recurrence, DateTime? nextDueDate, string? category, string? currency = null, bool isVariable = false, int? installmentCount = null, string? installmentStart = null, string? icon = null, string? color = null, int? reminderDays = null);
        Task<bool> DeletePaymentAsync(int userId, int paymentId);
        Task<Payment?> MarkPaidAsync(int userId, int paymentId, string cycleKey, decimal? actualAmount = null);
        Task<Payment?> UnmarkPaidAsync(int userId, int paymentId);
        Task<Payment?> SkipCycleAsync(int userId, int paymentId, string cycleKey);
        Task<List<PaymentRecord>> GetHistoryAsync(int userId, int months);
    }
}
