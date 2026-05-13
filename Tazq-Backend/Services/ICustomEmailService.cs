namespace Tazq_App.Services
{
	public interface ICustomEmailService
	{
		Task SendEmailAsync(string toEmail, string subject, string body);
		Task SendReminderEmailAsync(int userId, List<int> taskIds);
		Task SendWeeklySummaryEmailAsync(int userId);
		Task SendExportEmailAsync(int userId);
	}
}
