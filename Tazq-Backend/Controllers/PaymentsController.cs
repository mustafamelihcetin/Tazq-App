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
        }

        public class MarkPaidRequest
        {
            public string CycleKey { get; set; } = string.Empty;
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
                var payment = await _paymentService.CreatePaymentAsync(userId.Value, req.Title, req.Amount, req.DueDay, req.Recurrence, req.NextDueDate, req.Category, req.Currency);
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

            var payment = await _paymentService.UpdatePaymentAsync(userId.Value, id, req.Title, req.Amount, req.DueDay, req.Recurrence, req.NextDueDate, req.Category, req.Currency);
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

            var payment = await _paymentService.MarkPaidAsync(userId.Value, id, req.CycleKey);
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
