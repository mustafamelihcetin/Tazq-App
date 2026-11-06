using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
    /// <summary>
    /// Ödeme takibi — GÖREVLERDEN AYRI yüzey (bkz. Payment.cs başlığı). Bu controller
    /// hiçbir zaman TasksController/TaskService'i çağırmaz.
    /// </summary>
    [Route("api/payments")]
    [ApiController]
    [Authorize]
    public class PaymentsController : ControllerBase
    {
        private readonly IPaymentService _paymentService;
        private readonly FxRateService _fx;

        public PaymentsController(IPaymentService paymentService, FxRateService fx)
        {
            _paymentService = paymentService;
            _fx = fx;
        }

        private int? GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claim, out int id) ? id : null;
        }

        public class PaymentRequest
        {
            public string Title { get; set; } = string.Empty;
            public decimal Amount { get; set; }
            public int DueDay { get; set; }
            public PaymentRecurrence Recurrence { get; set; } = PaymentRecurrence.Monthly;
            public DateTime? NextDueDate { get; set; }
            public string? Category { get; set; }
            /// <summary>ISO 4217 (TRY/USD/EUR/GBP); boş = ana birim.</summary>
            public string? Currency { get; set; }
            /// <summary>Tutar her ay değişir (Amount = tahmin).</summary>
            public bool IsVariable { get; set; }
            /// <summary>Taksit sayısı (2–120); null = süresiz.</summary>
            public int? InstallmentCount { get; set; }
            /// <summary>İlk taksit dönemi ("YYYY-MM" / yıllıkta "YYYY").</summary>
            public string? InstallmentStart { get; set; }
            public string? Icon { get; set; }
            public string? Color { get; set; }
            public int? ReminderDays { get; set; }
        }

        public class MarkPaidRequest
        {
            public string CycleKey { get; set; } = string.Empty;
            /// <summary>Değişken tutarlı ödemede o ayın gerçek tutarı (isteğe bağlı).</summary>
            public decimal? Amount { get; set; }
        }

        [HttpGet]
        public async Task<IActionResult> GetPayments()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var payments = await _paymentService.GetPaymentsAsync(userId.Value);
            return Ok(payments);
        }

        [HttpPost]
        public async Task<IActionResult> CreatePayment([FromBody] PaymentRequest req)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            try
            {
                var payment = await _paymentService.CreatePaymentAsync(userId.Value, req.Title, req.Amount, req.DueDay, req.Recurrence, req.NextDueDate, req.Category, req.Currency, req.IsVariable, req.InstallmentCount, req.InstallmentStart, req.Icon, req.Color, req.ReminderDays);
                return Ok(payment);
            }
            catch (InvalidOperationException ex) when (ex.Message.StartsWith("PAYMENT_LIMIT_REACHED"))
            {
                return StatusCode(429, new { StatusCode = 429, Message = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePayment(int id, [FromBody] PaymentRequest req)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var payment = await _paymentService.UpdatePaymentAsync(userId.Value, id, req.Title, req.Amount, req.DueDay, req.Recurrence, req.NextDueDate, req.Category, req.Currency, req.IsVariable, req.InstallmentCount, req.InstallmentStart, req.Icon, req.Color, req.ReminderDays);
            if (payment == null) return NotFound();
            return Ok(payment);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePayment(int id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var success = await _paymentService.DeletePaymentAsync(userId.Value, id);
            if (!success) return NotFound();
            return NoContent();
        }

        /// <summary>Ödeme geçmişi — son `months` ay (1–24), yeniden eskiye.</summary>
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory([FromQuery] int months = 6)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            return Ok(await _paymentService.GetHistoryAsync(userId.Value, months));
        }

        /// <summary>Günlük kur (EUR tabanlı). Alınamazsa 503 — istemci yaklaşık toplamı gizler.</summary>
        [HttpGet("fx")]
        public async Task<IActionResult> GetFx()
        {
            var fx = await _fx.GetRatesAsync();
            return fx == null ? StatusCode(503) : Ok(fx);
        }

        [HttpPost("{id}/mark-paid")]
        public async Task<IActionResult> MarkPaid(int id, [FromBody] MarkPaidRequest req)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var payment = await _paymentService.MarkPaidAsync(userId.Value, id, req.CycleKey, req.Amount);
            if (payment == null) return NotFound();
            return Ok(payment);
        }

        [HttpPost("{id}/skip")]
        public async Task<IActionResult> Skip(int id, [FromBody] MarkPaidRequest req)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var payment = await _paymentService.SkipCycleAsync(userId.Value, id, req.CycleKey);
            if (payment == null) return NotFound();
            return Ok(payment);
        }

        [HttpPost("{id}/unmark-paid")]
        public async Task<IActionResult> UnmarkPaid(int id)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var payment = await _paymentService.UnmarkPaidAsync(userId.Value, id);
            if (payment == null) return NotFound();
            return Ok(payment);
        }
    }
}
