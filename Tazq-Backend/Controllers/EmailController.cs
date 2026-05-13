using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Tazq_App.Services;
using Tazq_App.Models;

namespace Tazq_App.Controllers
{
	[Route("api/email")]
	[ApiController]
	[Authorize]
	public class EmailController : ControllerBase
	{
		private readonly ICustomEmailService _emailService;

		public EmailController(ICustomEmailService emailService)
		{
			_emailService = emailService;
		}

		[HttpPost("send")]
		public async Task<IActionResult> SendEmail([FromBody] EmailRequestDto request)
		{
			var userId = GetUserId();
			if (userId == null)
				return Unauthorized(new { status = 401, message = "Invalid user ID in token." });

			try
			{
				switch (request.EmailType.ToLower())
				{
					case "reminder":
						if (request.TaskIds == null || !request.TaskIds.Any())
							return BadRequest("Task IDs are required for reminders.");
						await _emailService.SendReminderEmailAsync(userId.Value, request.TaskIds);
						break;
					case "weekly-summary":
						await _emailService.SendWeeklySummaryEmailAsync(userId.Value);
						break;
					case "export":
						await _emailService.SendExportEmailAsync(userId.Value);
						break;
					default:
						return BadRequest(new { status = 400, message = "Invalid email type." });
				}

				return Ok(new { message = "Email successfully sent." });
			}
			catch (KeyNotFoundException ex)
			{
				return NotFound(new { status = 404, message = ex.Message });
			}
			catch (ArgumentException ex)
			{
				return BadRequest(new { status = 400, message = ex.Message });
			}
		}

		private int? GetUserId()
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			return int.TryParse(userIdClaim, out int userId) ? userId : null;
		}
	}
}
