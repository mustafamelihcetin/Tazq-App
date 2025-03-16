using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Tazq_App.Data;
using Tazq_App.Services;

public class ScheduledEmailService : BackgroundService
{
	private readonly IServiceProvider _serviceProvider;
	private readonly ICustomEmailService _emailService;
	private readonly ILogger<ScheduledEmailService> _logger;

	public ScheduledEmailService(IServiceProvider serviceProvider, ICustomEmailService emailService, ILogger<ScheduledEmailService> logger)
	{
		_serviceProvider = serviceProvider;
		_emailService = emailService;
		_logger = logger;
	}

	protected override async Task ExecuteAsync(CancellationToken stoppingToken)
	{
		while (!stoppingToken.IsCancellationRequested)
		{
			using (var scope = _serviceProvider.CreateScope())
			{
				var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
				var now = DateTime.UtcNow.Date;

				try
				{
					_logger.LogInformation("Fetching user notification preferences...");

					var usersWithReminders = await dbContext.UserNotificationPreferences
						.Include(p => p.User)
						.Where(p => p.ReceiveWeeklySummary ||
									dbContext.Tasks.Any(t => t.UserId == p.UserId && t.DueDate.Date == now.AddDays(p.ReminderDaysBeforeDue)))
						.ToListAsync();

					foreach (var userPref in usersWithReminders)
					{
						var user = userPref.User;
						if (user == null) continue;

						try
						{
							var tasksDueSoon = await dbContext.Tasks
								.Where(t => t.UserId == user.Id && t.DueDate.Date == now.AddDays(userPref.ReminderDaysBeforeDue))
								.ToListAsync();

							if (tasksDueSoon.Any())
							{
								var subject = "Task Reminder";
								var body = $"Hello {user.Name},\n\nYou have {tasksDueSoon.Count} upcoming tasks that are due soon.";

								await _emailService.SendEmailAsync(user.Email, subject, body);
							}

							if (userPref.ReceiveWeeklySummary && DateTime.UtcNow.DayOfWeek == userPref.WeeklySummaryDay)
							{
								var allTasks = await dbContext.Tasks.Where(t => t.UserId == user.Id).ToListAsync();
								var summaryBody = $"Hello {user.Name},\n\nHere is your weekly summary:\n\n" +
												string.Join("\n", allTasks.Select(t => $"{t.Title} (Due: {t.DueDate:yyyy-MM-dd})"));

								await _emailService.SendEmailAsync(user.Email, "Weekly Task Summary", summaryBody);
							}
						}
						catch (Exception ex)
						{
							_logger.LogError($"Error processing notifications for user {user.Email}: {ex.Message}");
						}
					}
				}
				catch (Exception ex)
				{
					_logger.LogError($"Database error in ScheduledEmailService: {ex.Message}");
				}
			}

			await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
		}
	}
}
