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
					UseDefaultCredentials = false,
					Credentials = new NetworkCredential(smtpUser, smtpPass),
					EnableSsl = true
				};

				string displayName = Environment.GetEnvironmentVariable("SMTP_DISPLAY_NAME") ?? _smtpSettings.DisplayName ?? "TAZQ";
				var fromAddress = new MailAddress(smtpFrom, displayName, Encoding.UTF8);

				var mailMessage = new MailMessage
				{
					From = fromAddress,
					Subject = subject,
					Body = body,
					IsBodyHtml = true,
					SubjectEncoding = Encoding.UTF8,
					BodyEncoding = Encoding.UTF8
				};

				mailMessage.To.Add(toEmail);
				await client.SendMailAsync(mailMessage);
			}
			catch (Exception ex)
			{
				throw new Exception($"Failed to send email: {ex.Message}");
			}
		}

		public async Task SendWelcomeEmailAsync(string toEmail, string userName)
		{
			string subject = "TAZQ Dünyasına Hoş Geldin!";
			string content = $@"
				<p>Merhaba <b>{userName}</b>,</p>
				<p>TAZQ ailesine katıldığın için çok mutluyuz! Artık derin odaklanma, hayat modlarını yönetme ve üretkenliğini zirveye taşıma yolunda ilk adımını attın.</p>
				<p>TAZQ ile yapabileceklerinden bazıları:</p>
				<ul style=""padding-left: 20px; color: #334155; margin-bottom: 25px;"">
					<li style=""margin-bottom: 8px;""><b>Dönemsel Modlar:</b> Sınav, spor, kariyer gibi hayat dönemlerini otomatik planlarla yönet.</li>
					<li style=""margin-bottom: 8px;""><b>Derin Odaklanma:</b> Özelleştirilmiş Pomodoro zamanlayıcısı ve nefes egzersizleri ile dikkatini topla.</li>
					<li style=""margin-bottom: 8px;""><b>Haftalık Analiz:</b> Üretkenlik momentumunu ve başarılarını takip et.</li>
				</ul>
				<p>Odaklanmaya hemen başlamak için aşağıdaki butondan uygulamaya giriş yapabilirsin:</p>
				<div style=""text-align: center;"">
					<a href=""#"" class=""btn"">Hemen Giriş Yap</a>
				</div>
				<p>Herhangi bir sorun veya önerin olursa, uygulama içinden bize istediğin zaman destek talebi gönderebilirsin. Her zaman yanındayız.</p>
				<p>Keyifli ve odaklı günler dileriz,<br><b>TAZQ Ekibi</b></p>";

			string body = GetHtmlBaseLayout("Hoş Geldin!", content);
			await SendEmailAsync(toEmail, subject, body);
		}

		public async Task SendForgotPasswordEmailAsync(string toEmail, string userName, string resetCode)
		{
			string subject = "TAZQ Şifre Sıfırlama Talebi";
			string resetUrl = $"https://api.tazqapp.com/api/users/reset-password-form?token={Uri.EscapeDataString(resetCode)}";
			string content = $@"
				<p>Merhaba <b>{userName}</b>,</p>
				<p>TAZQ hesabının şifresini sıfırlamak için bir talepte bulundun. Aşağıdaki butona tıklayarak şifreni güvenli bir şekilde sıfırlayabilirsin:</p>
				<div style=""text-align: center; margin: 30px 0;"">
					<a href=""{resetUrl}"" class=""btn"" style=""background-color: #6366f1; color: #ffffff; padding: 14px 28px; border-radius: 12px; font-weight: 700; text-decoration: none; display: inline-block; box-shadow: 0 10px 20px rgba(99, 102, 241, 0.2);"">Şifremi Sıfırla</a>
				</div>
				<p>Bu bağlantı <b>1 saat</b> boyunca geçerlidir. Süre dolduğunda yeni bir şifre sıfırlama talebi oluşturman gerekecektir.</p>
				<p style=""font-size: 13px; color: #ef4444; font-weight: 500; margin-top: 25px;"">⚠️ Eğer bu talebi siz yapmadıysanız, lütfen bu e-postayı dikkate almayın. Hesabınız tamamen güvendedir.</p>
				<p>Sevgilerle,<br><b>TAZQ Güvenlik Ekibi</b></p>";

			string body = GetHtmlBaseLayout("Şifre Sıfırlama", content);
			await SendEmailAsync(toEmail, subject, body);
		}

		public async Task SendSupportConfirmationEmailAsync(string toEmail, string userName, string userMessage)
		{
			string subject = "Destek Talebiniz Alındı";
			string content = $@"
				<p>Merhaba <b>{userName}</b>,</p>
				<p>Destek ekibimize gönderdiğin mesaj başarıyla bize ulaştı. Talebini incelemeye aldık ve en kısa sürede (genellikle 24 saat içinde) sana yanıt vereceğiz.</p>
				<p>Gönderdiğin mesajın bir kopyası aşağıdadır:</p>
				<div class=""quote-box"">
					""{userMessage}""
				</div>
				<p>Yanıt geldiğinde sana yine bir bilgilendirme e-postası göndereceğiz. Ayrıca yanıtları uygulama içindeki Destek ekranından da her zaman takip edebilirsin.</p>
				<p>Sabrın için teşekkür eder, iyi günler dileriz,<br><b>TAZQ Destek Ekibi</b></p>";

			string body = GetHtmlBaseLayout("Destek Talebiniz Alındı", content);
			await SendEmailAsync(toEmail, subject, body);
		}

		public async Task SendSupportReplyEmailAsync(string toEmail, string userName, string originalMessage, string adminReply)
		{
			string subject = "Destek Talebiniz Yanıtlandı";
			string content = $@"
				<p>Merhaba <b>{userName}</b>,</p>
				<p>Destek ekibimize ilettiğin talebin yanıtlandı! Yanıt ayrıntıları aşağıda yer almaktadır:</p>
				
				<div style=""margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;"">
					<div style=""background-color: #f8fafc; padding: 15px 20px; border-bottom: 1px solid #e2e8f0;"">
						<p style=""margin: 0; font-size: 12px; font-weight: 700; color: #64748b;"">GÖNDERDİĞİNİZ MESAJ</p>
						<p style=""margin: 8px 0 0 0; color: #334155; font-style: italic;"">""{originalMessage}""</p>
					</div>
					<div style=""padding: 20px; background-color: #ffffff;"">
						<p style=""margin: 0; font-size: 12px; font-weight: 700; color: #059669;"">DESTEK EKİBİ YANITI</p>
						<p style=""margin: 8px 0 0 0; color: #0f172a; font-weight: 500;"">{adminReply}</p>
					</div>
				</div>

				<p>Detayları görmek veya ek bir soru sormak istersen, uygulama içindeki Destek ekranından bizimle yazışmaya devam edebilirsin.</p>
				<p style=""margin-bottom: 0;"">Sağlıklı günler dileriz,<br><b>TAZQ Destek Ekibi</b></p>";

			string body = GetHtmlBaseLayout("Talebiniz Yanıtlandı", content);
			await SendEmailAsync(toEmail, subject, body);
		}

		private static string GetHtmlBaseLayout(string title, string bodyContent)
		{
			return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""utf-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>{title}</title>
    <style>
        body {{
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            -webkit-font-smoothing: antialiased;
        }}
        .wrapper {{
            width: 100%;
            background-color: #f8fafc;
            padding: 40px 20px;
            box-sizing: border-box;
        }}
        .container {{
            max-width: 580px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03), 0 1px 4px rgba(15, 23, 42, 0.02);
            border: 1px solid rgba(15, 23, 42, 0.06);
        }}
        .header {{
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            padding: 40px 30px;
            text-align: center;
            color: #ffffff;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }}
        .header .logo {{
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -1.5px;
            margin-bottom: 8px;
        }}
        .content {{
            padding: 40px 30px;
            line-height: 1.6;
            font-size: 15px;
        }}
        .content p {{
            margin-top: 0;
            margin-bottom: 20px;
            color: #334155;
        }}
        .btn {{
            display: inline-block;
            background-color: #059669;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 9999px;
            font-weight: 600;
            margin-top: 10px;
            margin-bottom: 25px;
            text-align: center;
            box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.2), 0 2px 4px -1px rgba(5, 150, 105, 0.1);
        }}
        .code-box {{
            background-color: #f1f5f9;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            margin: 25px 0;
            border: 1px solid #e2e8f0;
        }}
        .code-value {{
            font-size: 32px;
            font-weight: 800;
            letter-spacing: 4px;
            color: #059669;
            font-family: 'Courier New', Courier, monospace;
            margin: 0;
        }}
        .quote-box {{
            background-color: #f8fafc;
            border-left: 4px solid #059669;
            border-radius: 4px;
            padding: 16px 20px;
            margin: 25px 0;
            font-style: italic;
            color: #475569;
        }}
        .footer {{
            background-color: #f8fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid rgba(15, 23, 42, 0.04);
            font-size: 12px;
            color: #64748b;
        }}
        .footer p {{
            margin: 0 0 8px 0;
        }}
        .footer a {{
            color: #059669;
            text-decoration: none;
            font-weight: 500;
        }}
    </style>
</head>
<body>
    <div class=""wrapper"">
        <div class=""container"">
            <div class=""header"">
                <div class=""logo"">TAZQ</div>
                <h1>{title}</h1>
            </div>
            <div class=""content"">
                {bodyContent}
            </div>
            <div class=""footer"">
                <p>© {DateTime.UtcNow.Year} TAZQ. Tüm Hakları Saklıdır.</p>
                <p>Bu e-posta otomatik olarak gönderilmiştir. Lütfen doğrudan yanıtlamayın.</p>
                <p><a href=""https://malthen.io"">malthen.io</a></p>
            </div>
        </div>
    </div>
</body>
</html>";
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