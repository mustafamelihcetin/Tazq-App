using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
	[Route("api/[controller]")]
	[ApiController]
	[Authorize]
	public class SupportController : ControllerBase
	{
		private readonly ISupportService _support;
		private readonly ILogger<SupportController> _logger;
		private readonly IBackgroundTaskQueue _emailQueue;

		// Veri erişimi ISupportService'te; mailler kuyruk üzerinden (kuyruk kendi
		// scope'unu açar). Controller yalnızca HTTP ile ilgilenir.
		public SupportController(ISupportService support, ILogger<SupportController> logger, IBackgroundTaskQueue emailQueue)
		{
			_support = support;
			_logger = logger;
			_emailQueue = emailQueue;
		}

		private int? GetUserId()
		{
			var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (int.TryParse(claim, out int id)) return id;
			return null;
		}

		public class SendSupportDto
		{
			public string Message { get; set; } = string.Empty;
		}

		public class ReplySupportDto
		{
			public string Reply { get; set; } = string.Empty;
		}

		public class ReportCrashDto
		{
			public string ErrorMessage { get; set; } = string.Empty;
			public string StackTrace { get; set; } = string.Empty;
			public string DeviceName { get; set; } = string.Empty;
			public string Platform { get; set; } = string.Empty;
			public string AppVersion { get; set; } = string.Empty;
		}

		// POST: api/support/report-crash (Public / AllowAnonymous)
		[HttpPost("report-crash")]
		[AllowAnonymous]
		public async Task<IActionResult> ReportCrash([FromBody] ReportCrashDto dto)
		{
			var crash = await _support.ReportCrashAsync(new ClientCrash
			{
				ErrorMessage = dto.ErrorMessage ?? "Unknown Error",
				StackTrace = dto.StackTrace ?? string.Empty,
				DeviceName = dto.DeviceName ?? "Unknown Device",
				Platform = dto.Platform ?? "Unknown Platform",
				AppVersion = dto.AppVersion ?? "1.0.0",
				CreatedAt = DateTime.UtcNow,
			}, GetUserId());

			_logger.LogError("CLIENT CRASH [{Platform} - {DeviceName} - v{AppVersion}]: {ErrorMessage}\nStack: {StackTrace}",
				crash.Platform, crash.DeviceName, crash.AppVersion, crash.ErrorMessage, crash.StackTrace);

			return Ok(new { success = true, id = crash.Id });
		}

		// GET: api/support/admin/crashes (Sadece Admin)
		[HttpGet("admin/crashes")]
		[Authorize(Roles = "Admin")]
		public async Task<IActionResult> GetCrashes([FromQuery] int limit = 50)
		{
			var crashes = await _support.GetCrashesAsync(limit);
			return Ok(new { crashes });
		}

		// PATCH: api/support/admin/crashes/{id}/resolve (Sadece Admin)
		[HttpPatch("admin/crashes/{id}/resolve")]
		[Authorize(Roles = "Admin")]
		public async Task<IActionResult> ResolveCrash(int id)
		{
			if (!await _support.ResolveCrashAsync(id)) return NotFound();
			return Ok(new { success = true });
		}

		// POST: api/support
		[HttpPost]
		public async Task<IActionResult> SendMessage([FromBody] SendSupportDto dto)
		{
			if (string.IsNullOrWhiteSpace(dto.Message))
				return BadRequest(new { message = "Mesaj boş olamaz." });

			var userId = GetUserId();
			if (userId == null) return Unauthorized();

			var supportMsg = await _support.CreateMessageAsync(userId.Value, dto.Message);
			if (supportMsg == null) return NotFound(new { message = "Kullanıcı bulunamadı." });

			var (email, name, message) = (supportMsg.UserEmail, supportMsg.UserName, supportMsg.Message);
			_emailQueue.Enqueue((sp, ct) =>
				sp.GetRequiredService<ICustomEmailService>()
				  .SendSupportConfirmationEmailAsync(email, name, message));

			return Ok(new { success = true, id = supportMsg.Id });
		}

		// GET: api/support/mine — kullanıcının KENDİ mesajları + admin yanıtları (salt-okunur)
		[HttpGet("mine")]
		public async Task<IActionResult> GetMyMessages()
		{
			var userId = GetUserId();
			if (userId == null) return Unauthorized();

			var messages = (await _support.GetMessagesForUserAsync(userId.Value))
				.Select(m => new { m.Id, m.Message, m.CreatedAt, m.AdminReply, m.RepliedAt });

			return Ok(new { messages });
		}

		// PATCH: api/support/admin/{id}/reply (Sadece Admin) — kullanıcının mesajına yanıt yaz
		[HttpPatch("admin/{id}/reply")]
		[Authorize(Roles = "Admin")]
		public async Task<IActionResult> ReplyMessage(int id, [FromBody] ReplySupportDto dto)
		{
			if (string.IsNullOrWhiteSpace(dto.Reply))
				return BadRequest(new { message = "Yanıt boş olamaz." });

			var msg = await _support.ReplyAsync(id, dto.Reply);
			if (msg == null) return NotFound();

			// ReplyAsync AdminReply'ı her zaman doldurur; derleyici bunu servis sınırının
			// ötesinden kanıtlayamadığı için açık coalesce.
			var (replyEmail, replyName, replyMessage, adminReply) = (msg.UserEmail, msg.UserName, msg.Message, msg.AdminReply ?? string.Empty);
			_emailQueue.Enqueue((sp, ct) =>
				sp.GetRequiredService<ICustomEmailService>()
				  .SendSupportReplyEmailAsync(replyEmail, replyName, replyMessage, adminReply));

			return Ok(new { success = true, repliedAt = msg.RepliedAt });
		}

		// GET: api/support/admin/all (Sadece Admin)
		[HttpGet("admin/all")]
		[Authorize(Roles = "Admin")]
		public async Task<IActionResult> GetAllMessages()
		{
			var messages = await _support.GetAllMessagesAsync();
			var unreadCount = messages.Count(m => !m.IsRead);
			return Ok(new { messages, unreadCount });
		}

		// PATCH: api/support/admin/{id}/read (Sadece Admin)
		[HttpPatch("admin/{id}/read")]
		[Authorize(Roles = "Admin")]
		public async Task<IActionResult> MarkAsRead(int id)
		{
			if (!await _support.MarkAsReadAsync(id)) return NotFound();
			return Ok(new { success = true });
		}

		// DELETE: api/support/admin/{id} (Sadece Admin)
		[HttpDelete("admin/{id}")]
		[Authorize(Roles = "Admin")]
		public async Task<IActionResult> DeleteMessage(int id)
		{
			if (!await _support.DeleteMessageAsync(id)) return NotFound();
			return Ok(new { success = true });
		}
	}
}
