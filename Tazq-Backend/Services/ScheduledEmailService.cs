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
				var now = DateTime.UtcNow;
				var currentHour = now.Hour;

				try
				{
					_logger.LogInformation("Checking notification schedules (Hour: {Hour})...", currentHour);
					var cryptoService = scope.ServiceProvider.GetRequiredService<ICryptoService>();

					var usersWithReminders = await dbContext.UserNotificationPreferences
						.Include(p => p.User)
						.AsNoTracking()
						.Where(p => p.ReceiveWeeklySummary ||
									dbContext.Tasks.Any(t => t.UserId == p.UserId && t.DueDate.HasValue))
						.ToListAsync(stoppingToken);

					foreach (var userPref in usersWithReminders)
					{
						var user = userPref.User;
						if (user == null) continue;

						// Only send at the user's preferred notification time
						if (userPref.NotificationTimeOfDay.Hours != currentHour)
							continue;

						try
						{
							var targetDateStart = DateTime.SpecifyKind(now.Date.AddDays(userPref.ReminderDaysBeforeDue), DateTimeKind.Utc);
							var targetDateEnd = targetDateStart.AddDays(1);

							var tasksDueSoon = await dbContext.Tasks
								.AsNoTracking()
								.Where(t => t.UserId == user.Id && t.DueDate.HasValue && t.DueDate.Value >= targetDateStart && t.DueDate.Value < targetDateEnd)
								.ToListAsync(stoppingToken);

							if (tasksDueSoon.Any())
							{
								var subject = "Task Reminder";
								var body = $"Hello {user.Name},\n\nYou have {tasksDueSoon.Count} upcoming tasks that are due soon.";

								await _emailService.SendEmailAsync(user.Email, subject, body);
							}

							if (userPref.ReceiveWeeklySummary && now.DayOfWeek == userPref.WeeklySummaryDay)
							{
								var userKey = cryptoService.GetKeyForUser(user.Id);
								var allTasks = await dbContext.Tasks
									.AsNoTracking()
									.Where(t => t.UserId == user.Id)
									.ToListAsync(stoppingToken);

								string DecryptTitle(string rawTitle)
								{
									if (userKey == null || string.IsNullOrWhiteSpace(rawTitle)) return rawTitle;
									try { return cryptoService.Decrypt(rawTitle, userKey); }
									catch { return rawTitle; }
								}

								var summaryBody = $"Hello {user.Name},\n\nHere is your weekly summary:\n\n" +
												string.Join("\n", allTasks.Select(t => $"{DecryptTitle(t.Title)} (Due: {t.DueDate:yyyy-MM-dd})"));

								await _emailService.SendEmailAsync(user.Email, "Weekly Task Summary", summaryBody);
							}
						}
						catch (Exception ex)
						{
							_logger.LogError("Error processing notifications for user {Email}: {Message}", user.Email, ex.Message);
						}
					}
				}
				catch (Exception ex)
				{
					_logger.LogError("Database error in ScheduledEmailService: {Message}", ex.Message);
				}
			}

			await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
		}
	}
}
