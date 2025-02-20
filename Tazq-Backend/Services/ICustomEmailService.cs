namespace Tazq_App.Services
{
	public interface ICustomEmailService
	{
		Task SendEmailAsync(string toEmail, string subject, string body);
	}
}
