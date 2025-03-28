using System;
using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using System.Threading.Tasks;
using Tazq_App.Models;

namespace Tazq_App.Services
{
	public class CustomEmailService : ICustomEmailService
	{
		private readonly SmtpSettings _smtpSettings;

		public CustomEmailService(IOptions<SmtpSettings> smtpSettings)
		{
			_smtpSettings = smtpSettings.Value ?? throw new ArgumentNullException(nameof(smtpSettings), "SMTP settings cannot be null.");
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

			// DEBUG LOGS FOR RENDER ENVIRONMENT
			Console.WriteLine("======= SMTP DEBUG START =======");
			Console.WriteLine($"SMTP_HOST: {smtpHost}");
			Console.WriteLine($"SMTP_USERNAME: {smtpUser}");
			Console.WriteLine($"SMTP_FROM: {smtpFrom}");
			Console.WriteLine($"SMTP_PORT: {smtpPort}");
			Console.WriteLine("======= SMTP DEBUG END ========");

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
	}
}