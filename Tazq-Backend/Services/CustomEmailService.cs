using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using System;

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
			if (string.IsNullOrWhiteSpace(toEmail))
			{
				throw new ArgumentException("Recipient email cannot be empty.", nameof(toEmail));
			}

			if (!toEmail.Contains("@"))
			{
				throw new ArgumentException("Invalid email format.", nameof(toEmail));
			}

			if (string.IsNullOrWhiteSpace(subject))
			{
				throw new ArgumentException("Email subject cannot be empty.", nameof(subject));
			}

			if (string.IsNullOrWhiteSpace(body))
			{
				throw new ArgumentException("Email body cannot be empty.", nameof(body));
			}

			if (_smtpSettings.Port <= 0)
			{
				throw new ArgumentOutOfRangeException(nameof(_smtpSettings.Port), "SMTP Port must be a positive non-zero value.");
			}

			using var smtpClient = new SmtpClient
			{
				Host = _smtpSettings.Server ?? throw new InvalidOperationException("SMTP server is not configured."),
				Port = _smtpSettings.Port,
				Credentials = new NetworkCredential(
					_smtpSettings.Username ?? throw new InvalidOperationException("SMTP username is not configured."),
					_smtpSettings.Password ?? throw new InvalidOperationException("SMTP password is not configured.")
				),
				EnableSsl = true
			};

			var fromEmail = _smtpSettings.FromEmail ?? throw new InvalidOperationException("SMTP_FROM_EMAIL is not set in configuration.");

			var mailMessage = new MailMessage
			{
				From = new MailAddress(fromEmail),
				Subject = subject,
				Body = body,
				IsBodyHtml = true
			};

			mailMessage.To.Add(toEmail);

			await smtpClient.SendMailAsync(mailMessage);
		}
	}
}
