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

        public PaymentsController(IPaymentService paymentService)
        {
            _paymentService = paymentService;
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
                var payment = await _paymentService.CreatePaymentAsync(userId.Value, req.Title, req.Amount, req.DueDay, req.Recurrence, req.NextDueDate, req.Category);
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

            var payment = await _paymentService.UpdatePaymentAsync(userId.Value, id, req.Title, req.Amount, req.DueDay, req.Recurrence, req.NextDueDate, req.Category);
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
