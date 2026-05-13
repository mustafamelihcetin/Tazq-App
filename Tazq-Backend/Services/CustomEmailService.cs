using System;
using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
	public class CustomEmailService : ICustomEmailService
	{
		private readonly SmtpSettings _smtpSettings;
		private readonly IServiceProvider _serviceProvider;

		public CustomEmailService(IOptions<SmtpSettings> smtpSettings, IServiceProvider serviceProvider)
		{
			_smtpSettings = smtpSettings.Value ?? throw new ArgumentNullException(nameof(smtpSettings), "SMTP settings cannot be null.");
			_serviceProvider = serviceProvider;
		}

		public async Task SendEmailAsync(string toEmail, string subject, string body)
		{
			string smtpHost = Environment.GetEnvironmentVariable("SMTP_SERVER") ?? _smtpSettings.Host;
			string smtpUser = Environment.GetEnvironmentVariable("SMTP_USERNAME") ?? _smtpSettings.Username;
			string smtpPass = Environment.GetEnvironmentVariable("SMTP_PASSWORD") ?? _smtpSettings.Password;
			string smtpFrom = Environment.GetEnvironmentVariable("SMTP_FROM_EMAIL") ?? _smtpSettings.From;

			if (!int.TryParse(Environment.GetEnvironmentVariable("SMTP_PORT"), out int smtpPort))
			{
				smtpPort = _smtpSettings.Port;
			}

			if (string.IsNullOrWhiteSpace(smtpHost) || string.IsNullOrWhiteSpace(smtpUser) ||
				string.IsNullOrWhiteSpace(smtpPass) || string.IsNullOrWhiteSpace(smtpFrom))
			{
				throw new Exception("SMTP configuration is missing or invalid. Check your environment variables or appsettings.json.");
			}

			try
			{
				using var client = new SmtpClient(smtpHost)
				{
					Port = smtpPort,
					Credentials = new NetworkCredential(smtpUser, smtpPass),
					EnableSsl = true
				};

				var mailMessage = new MailMessage
				{
					From = new MailAddress(smtpFrom),
					Subject = subject,
					Body = body,
					IsBodyHtml = true
				};

				mailMessage.To.Add(toEmail);
				await client.SendMailAsync(mailMessage);
			}
			catch (Exception ex)
			{
				throw new Exception($"Failed to send email: {ex.Message}");
			}
		}

		public async Task SendReminderEmailAsync(int userId, List<int> taskIds)
		{
			using var scope = _serviceProvider.CreateScope();
			var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

			var user = await context.Users.FindAsync(userId);
			if (user == null) throw new KeyNotFoundException("User not found.");

			var tasks = await context.Tasks.Where(t => taskIds.Contains(t.Id) && t.UserId == userId).ToListAsync();
			if (!tasks.Any()) throw new ArgumentException("No valid tasks found for this reminder.");

			string subject = "Task Reminder";
			string body = FormatTaskList("You have upcoming tasks to complete:", tasks);
			await SendEmailAsync(user.Email, subject, body);
		}

		public async Task SendWeeklySummaryEmailAsync(int userId)
		{
			using var scope = _serviceProvider.CreateScope();
			var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

			var user = await context.Users.FindAsync(userId);
			if (user == null) throw new KeyNotFoundException("User not found.");

			var pendingTasks = await context.Tasks.Where(t => t.UserId == userId && !t.IsCompleted).ToListAsync();
			string subject = "Weekly Summary - Your Pending Tasks";
			string body = pendingTasks.Any()
				? FormatTaskList("Here are your pending tasks:", pendingTasks)
				: "You have completed all your tasks for this week.";
			await SendEmailAsync(user.Email, subject, body);
		}

		public async Task SendExportEmailAsync(int userId)
		{
			using var scope = _serviceProvider.CreateScope();
			var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

			var user = await context.Users.FindAsync(userId);
			if (user == null) throw new KeyNotFoundException("User not found.");

			var allTasks = await context.Tasks.Where(t => t.UserId == userId).ToListAsync();
			string subject = "Exported Task List";
			string body = allTasks.Any()
				? FormatTaskList("Your complete task list:", allTasks)
				: "You have no tasks in your list.";
			await SendEmailAsync(user.Email, subject, body);
		}

		private static string FormatTaskList(string title, List<TaskItem> tasks)
		{
			StringBuilder sb = new();
			sb.AppendLine(title);
			foreach (var task in tasks)
				sb.AppendLine($"- {task.Title} (Due: {task.DueDate:yyyy-MM-dd}) - {(task.IsCompleted ? "Completed" : "Pending")}");
			return sb.ToString();
		}
	}
}