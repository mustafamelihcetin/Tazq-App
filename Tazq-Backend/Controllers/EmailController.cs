using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Tazq_App.Services;
using Tazq_App.Data;
using Tazq_App.Models;

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
		if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
			return Unauthorized("User ID not found in token.");

		var user = await _context.Users.FindAsync(userId);
		if (user == null)
			return NotFound("User not found.");

		return request.EmailType.ToLower() switch
		{
			"reminder" => await SendReminderEmail(userId, user.Email, request.TaskIds),
			"weekly-summary" => await SendWeeklySummaryEmail(userId, user.Email),
			"export" => await SendExportEmail(userId, user.Email),
			_ => BadRequest("Invalid email type. Allowed types: reminder, weekly-summary, export.")
		};
	}

	private async Task<IActionResult> SendReminderEmail(int userId, string email, List<int>? taskIds)
	{
		if (taskIds == null || !taskIds.Any())
			return BadRequest("Task IDs are required for reminders.");

		var tasks = await _context.Tasks.Where(t => taskIds.Contains(t.Id) && t.UserId == userId).ToListAsync();
		if (!tasks.Any())
			return BadRequest("No valid tasks found for this reminder.");

		string subject = "Task Reminder";
		string body = FormatTaskList("You have upcoming tasks to complete:", tasks);

		return await SendEmailInternal(email, subject, body);
	}

	private async Task<IActionResult> SendWeeklySummaryEmail(int userId, string email)
	{
		var pendingTasks = await _context.Tasks.Where(t => t.UserId == userId && !t.IsCompleted).ToListAsync();
		string subject = "Weekly Summary - Your Pending Tasks";
		string body = pendingTasks.Any()
			? FormatTaskList("Here are your pending tasks:", pendingTasks)
			: "You have completed all your tasks for this week.";

		return await SendEmailInternal(email, subject, body);
	}

	private async Task<IActionResult> SendExportEmail(int userId, string email)
	{
		var allTasks = await _context.Tasks.Where(t => t.UserId == userId).ToListAsync();
		string subject = "Exported Task List";
		string body = allTasks.Any()
			? FormatTaskList("Your complete task list:", allTasks)
			: "You have no tasks in your list.";

		return await SendEmailInternal(email, subject, body);
	}

	private static string FormatTaskList(string title, List<TaskItem> tasks)
	{
		StringBuilder sb = new();
		sb.AppendLine(title);
		foreach (var task in tasks)
			sb.AppendLine($"- {task.Title} (Due: {task.DueDate:yyyy-MM-dd}) - {(task.IsCompleted ? "Completed" : "Pending")}");
		return sb.ToString();
	}

	private async Task<IActionResult> SendEmailInternal(string email, string subject, string body)
	{
		await _emailService.SendEmailAsync(email, subject, body);
		return Ok(new { message = $"Email successfully sent to {email}." });
	}
}
