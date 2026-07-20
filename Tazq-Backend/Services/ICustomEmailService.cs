namespace Tazq_App.Services
{
	public interface ICustomEmailService
	{
		Task SendEmailAsync(string toEmail, string subject, string body);
		Task SendReminderEmailAsync(int userId, List<int> taskIds);
		Task SendWeeklySummaryEmailAsync(int userId);
		Task SendExportEmailAsync(int userId);
		Task SendWelcomeEmailAsync(string toEmail, string userName);
		Task SendVerificationEmailAsync(string toEmail, string userName, string code);
		Task SendForgotPasswordEmailAsync(string toEmail, string userName, string resetCode);
		Task SendSupportConfirmationEmailAsync(string toEmail, string userName, string userMessage);
		Task SendSupportReplyEmailAsync(string toEmail, string userName, string originalMessage, string adminReply);
		Task SendAdminSignupDigestAsync(string toEmail, DateOnly day, IReadOnlyList<SignupDigestEntry> signups);
	}

	/// <summary>Günlük admin kayıt özetinde tek bir yeni üyeyi temsil eder.</summary>
	public record SignupDigestEntry(string Name, string Email, DateTime CreatedAtUtc, bool IsEmailVerified, string Provider);
}
