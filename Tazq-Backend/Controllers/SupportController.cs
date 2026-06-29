using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Controllers
{
	[Route("api/[controller]")]
	[ApiController]
	[Authorize]
	public class SupportController : ControllerBase
	{
		private readonly AppDbContext _db;

		public SupportController(AppDbContext db)
		{
			_db = db;
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

			return Ok(new { success = true, id = supportMsg.Id });
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
