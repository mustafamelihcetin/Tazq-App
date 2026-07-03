using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
	[Route("api/[controller]")]
	[ApiController]
	[Authorize]
	public class SupportController : ControllerBase
	{
		private readonly AppDbContext _db;
		private readonly ICustomEmailService _emailService;
		private readonly ILogger<SupportController> _logger;

		public SupportController(AppDbContext db, ICustomEmailService emailService, ILogger<SupportController> logger)
		{
			_db = db;
			_emailService = emailService;
			_logger = logger;
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
			var crash = new ClientCrash
			{
				ErrorMessage = dto.ErrorMessage ?? "Unknown Error",
				StackTrace = dto.StackTrace ?? string.Empty,
				DeviceName = dto.DeviceName ?? "Unknown Device",
				Platform = dto.Platform ?? "Unknown Platform",
				AppVersion = dto.AppVersion ?? "1.0.0",
				CreatedAt = DateTime.UtcNow
			};

			var userId = GetUserId();
			if (userId != null)
			{
				crash.UserId = userId.Value;
				var user = await _db.Users.FindAsync(userId.Value);
				if (user != null)
				{
					crash.UserEmail = user.Email;
				}
			}

			_db.ClientCrashes.Add(crash);
			await _db.SaveChangesAsync();

			_logger.LogError("CLIENT CRASH [{Platform} - {DeviceName} - v{AppVersion}]: {ErrorMessage}\nStack: {StackTrace}", 
				crash.Platform, crash.DeviceName, crash.AppVersion, crash.ErrorMessage, crash.StackTrace);

			return Ok(new { success = true, id = crash.Id });
		}

		// GET: api/support/admin/crashes (Sadece Admin)
		[HttpGet("admin/crashes")]
		[Authorize(Roles = "Admin")]
		public async Task<IActionResult> GetCrashes([FromQuery] int limit = 50)
		{
			var crashes = await _db.ClientCrashes
				.OrderByDescending(c => c.CreatedAt)
				.Take(limit)
				.AsNoTracking()
				.ToListAsync();

			return Ok(new { crashes });
		}

		// PATCH: api/support/admin/crashes/{id}/resolve (Sadece Admin)
		[HttpPatch("admin/crashes/{id}/resolve")]
		[Authorize(Roles = "Admin")]
		public async Task<IActionResult> ResolveCrash(int id)
		{
			var crash = await _db.ClientCrashes.FindAsync(id);
			if (crash == null) return NotFound();

			crash.IsResolved = true;
			await _db.SaveChangesAsync();

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

			var user = await _db.Users.FindAsync(userId.Value);
			if (user == null) return NotFound(new { message = "Kullanıcı bulunamadı." });

			var supportMsg = new SupportMessage
			{
				UserId = user.Id,
				UserName = user.Name,
				UserEmail = user.Email,
				Message = dto.Message.Trim(),
				CreatedAt = DateTime.UtcNow,
				IsRead = false
			};

			_db.SupportMessages.Add(supportMsg);
			await _db.SaveChangesAsync();

			_ = Task.Run(async () =>
			{
				try
				{
					await _emailService.SendSupportConfirmationEmailAsync(user.Email, user.Name, supportMsg.Message);
				}
				catch (Exception ex)
				{
					_logger.LogError(ex, "Failed to send support message confirmation to {Email}", user.Email);
				}
			});

			return Ok(new { success = true, id = supportMsg.Id });
		}

		// GET: api/support/mine — kullanıcının KENDİ mesajları + admin yanıtları (salt-okunur)
		[HttpGet("mine")]
		public async Task<IActionResult> GetMyMessages()
		{
			var userId = GetUserId();
			if (userId == null) return Unauthorized();

			var messages = await _db.SupportMessages
				.Where(m => m.UserId == userId.Value)
				.OrderByDescending(m => m.CreatedAt)
				.Select(m => new
				{
					m.Id,
					m.Message,
					m.CreatedAt,
					m.AdminReply,
					m.RepliedAt
				})
				.AsNoTracking()
				.ToListAsync();

			return Ok(new { messages });
		}

		// PATCH: api/support/admin/{id}/reply (Sadece Admin) — kullanıcının mesajına yanıt yaz
		[HttpPatch("admin/{id}/reply")]
		[Authorize(Roles = "Admin")]
		public async Task<IActionResult> ReplyMessage(int id, [FromBody] ReplySupportDto dto)
		{
			if (string.IsNullOrWhiteSpace(dto.Reply))
				return BadRequest(new { message = "Yanıt boş olamaz." });

			var msg = await _db.SupportMessages.FindAsync(id);
			if (msg == null) return NotFound();

			msg.AdminReply = dto.Reply.Trim();
			msg.RepliedAt = DateTime.UtcNow;
			msg.IsRead = true;
			await _db.SaveChangesAsync();

			_ = Task.Run(async () =>
			{
				try
				{
					await _emailService.SendSupportReplyEmailAsync(msg.UserEmail, msg.UserName, msg.Message, msg.AdminReply);
				}
				catch (Exception ex)
				{
					_logger.LogError(ex, "Failed to send support reply notification to {Email}", msg.UserEmail);
				}
			});

			return Ok(new { success = true, repliedAt = msg.RepliedAt });
		}

		// GET: api/support/admin/all (Sadece Admin)
		[HttpGet("admin/all")]
		[Authorize(Roles = "Admin")]
		public async Task<IActionResult> GetAllMessages()
		{
			var messages = await _db.SupportMessages
				.OrderByDescending(m => m.CreatedAt)
				.AsNoTracking()
				.ToListAsync();

			var unreadCount = messages.Count(m => !m.IsRead);

			return Ok(new { messages, unreadCount });
		}

		// PATCH: api/support/admin/{id}/read (Sadece Admin)
		[HttpPatch("admin/{id}/read")]
		[Authorize(Roles = "Admin")]
		public async Task<IActionResult> MarkAsRead(int id)
		{
			var msg = await _db.SupportMessages.FindAsync(id);
			if (msg == null) return NotFound();

			msg.IsRead = true;
			await _db.SaveChangesAsync();

			return Ok(new { success = true });
		}

		// DELETE: api/support/admin/{id} (Sadece Admin)
		[HttpDelete("admin/{id}")]
		[Authorize(Roles = "Admin")]
		public async Task<IActionResult> DeleteMessage(int id)
		{
			var msg = await _db.SupportMessages.FindAsync(id);
			if (msg == null) return NotFound();

			_db.SupportMessages.Remove(msg);
			await _db.SaveChangesAsync();

			return Ok(new { success = true });
		}
	}
}
