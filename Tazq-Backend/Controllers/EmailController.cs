using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Threading.Tasks;
using Tazq_App.Services;
using Tazq_App.Data;
using Tazq_App.Models; // EmailRequestDto burada tanımlandı
using Microsoft.EntityFrameworkCore;
using System.Text;

[Route("api/email")]
[ApiController]
[Authorize]
public class EmailController : ControllerBase
{
	private readonly ICustomEmailService _emailService;
	private readonly AppDbContext _context;

	public EmailController(ICustomEmailService emailService, AppDbContext context)
	{
		_emailService = emailService;
		_context = context;
	}

	[HttpPost("send")]
	public async Task<IActionResult> SendEmail([FromBody] EmailRequestDto request)
	{
		var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
		if (userIdClaim == null)
			return Unauthorized("User ID not found in token.");

		if (!int.TryParse(userIdClaim, out int userId))
			return Unauthorized("Invalid user ID in token.");

		var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
		if (user == null)
			return NotFound("User not found.");

		string subject = "";
		string body = "";

		switch (request.EmailType.ToLower())
		{
			case "reminder":
				if (request.TaskIds == null || !request.TaskIds.Any())
					return BadRequest("Task IDs are required for reminders.");

				var tasks = await _context.Tasks
					.Where(t => request.TaskIds.Contains(t.Id) && t.UserId == userId)
					.ToListAsync();

				if (!tasks.Any())
					return BadRequest("No valid tasks found for this reminder.");

				subject = "Task Reminder";
				var taskList = new StringBuilder();
				taskList.AppendLine("You have upcoming tasks to complete:");
				foreach (var task in tasks)
				{
					string dueDateString = task.DueDate != null ? task.DueDate.ToString("yyyy-MM-dd") : "No due date";
					taskList.AppendLine($"- {task.Title} (Due: {dueDateString})");
				}
				body = taskList.ToString();
				break;

			case "weekly-summary":
				var pendingTasks = await _context.Tasks
					.Where(t => t.UserId == userId && !t.IsCompleted)
					.ToListAsync();

				subject = "Weekly Summary - Your Pending Tasks";
				if (pendingTasks.Any())
				{
					var summary = new StringBuilder();
					summary.AppendLine("Here are the tasks you have not completed yet:");
					foreach (var task in pendingTasks)
					{
						string dueDateString = task.DueDate != null ? task.DueDate.ToString("yyyy-MM-dd") : "No due date";
						summary.AppendLine($"- {task.Title} (Due: {dueDateString})");
					}
					body = summary.ToString();
				}
				else
				{
					body = "You have completed all your tasks for this week.";
				}
				break;

			case "export":
				var allTasks = await _context.Tasks
					.Where(t => t.UserId == userId)
					.ToListAsync();

				subject = "Exported Task List";
				if (allTasks.Any())
				{
					var exportData = new StringBuilder();
					exportData.AppendLine("Your complete task list:");
					foreach (var task in allTasks)
					{
						string dueDateString = task.DueDate != null ? task.DueDate.ToString("yyyy-MM-dd") : "No due date";
						exportData.AppendLine($"- {task.Title} (Due: {dueDateString}) - {(task.IsCompleted ? "Completed" : "Pending")}");
					}
					body = exportData.ToString();
				}
				else
				{
					body = "You have no tasks in your list.";
				}
				break;

			default:
				return BadRequest("Invalid email type. Allowed types: reminder, weekly-summary, export.");
		}

		try
		{
			await _emailService.SendEmailAsync(user.Email, subject, body);
			return Ok(new { message = $"Email successfully sent to {user.Email}." });
		}
		catch (Exception ex)
		{
			return StatusCode(500, new { error = "Failed to send email.", details = ex.Message });
		}
	}

}
