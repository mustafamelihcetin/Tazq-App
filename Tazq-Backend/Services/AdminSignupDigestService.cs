using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;

namespace Tazq_App.Services
{
	/// <summary>
	/// Günde bir kez admin'e dünkü yeni üye özetini gönderir.
	///
	/// Neden anlık değil de özet: kayıt başına mail ilk yüz kullanıcıda tatlı, sonrasında
	/// okunmayan bir gürültüye ve gelen kutusunda biriken kalıcı PII'ye dönüşüyor. Özet
	/// hem hacimle ölçekleniyor hem de sıfır günleri raporladığı için kayıt akışının
	/// bozulmasını yakalıyor.
	/// </summary>
	public class AdminSignupDigestService : BackgroundService
	{
		private readonly IServiceProvider _serviceProvider;
		private readonly ILogger<AdminSignupDigestService> _logger;

		// En son özet gönderilen gün (UTC). Yoklama döngüsünde aynı günü iki kez göndermeyi engeller;
		// süreç yeniden başlarsa sıfırlanır, o gün için ikinci bir özet gidebilir. Tek yan etkisi
		// mükerrer bir bilgilendirme maili olduğu için kalıcı durum tutmaya değmez.
		private DateOnly? _lastSentDay;

		public AdminSignupDigestService(IServiceProvider serviceProvider, ILogger<AdminSignupDigestService> logger)
		{
			_serviceProvider = serviceProvider;
			_logger = logger;
		}

		// Özetin gönderileceği UTC saat. Varsayılan 06:00 UTC (TR ile 09:00).
		private static int DigestHourUtc =>
			int.TryParse(Environment.GetEnvironmentVariable("ADMIN_DIGEST_HOUR_UTC"), out var h) && h >= 0 && h <= 23
				? h : 6;

		// ADMIN_EMAIL + ADMIN_EMAILS birleşimi. Hiçbiri tanımlı değilse özet tamamen kapalıdır.
		private static string[] Recipients =>
			new[] { Environment.GetEnvironmentVariable("ADMIN_EMAIL") ?? "" }
				.Concat((Environment.GetEnvironmentVariable("ADMIN_EMAILS") ?? "")
					.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
				.Where(e => !string.IsNullOrWhiteSpace(e))
				.Distinct(StringComparer.OrdinalIgnoreCase)
				.ToArray();

		protected override async Task ExecuteAsync(CancellationToken stoppingToken)
		{
			while (!stoppingToken.IsCancellationRequested)
			{
				try
				{
					await TrySendDigestAsync(stoppingToken);
				}
				catch (Exception ex)
				{
					// Özet gönderimi uygulamanın çalışmasını etkilememeli; bir sonraki turda tekrar denenir.
					_logger.LogError(ex, "Admin kayıt özeti gönderilemedi");
				}

				try
				{
					await Task.Delay(TimeSpan.FromMinutes(20), stoppingToken);
				}
				catch (OperationCanceledException) { return; }
			}
		}

		private async Task TrySendDigestAsync(CancellationToken ct)
		{
			var now = DateTime.UtcNow;
			var today = DateOnly.FromDateTime(now);

			if (now.Hour < DigestHourUtc) return;   // gün için saat henüz gelmedi
			if (_lastSentDay == today) return;      // bugünkü özet zaten gitti

			var recipients = Recipients;
			if (recipients.Length == 0)
			{
				_lastSentDay = today; // alıcı yok → bugün için boşuna sorgu atma
				return;
			}

			using var scope = _serviceProvider.CreateScope();
			var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
			var emailService = scope.ServiceProvider.GetRequiredService<ICustomEmailService>();

			var entries = await CollectSignupsAsync(db, today.AddDays(-1), ct);

			foreach (var recipient in recipients)
			{
				try
				{
					await emailService.SendAdminSignupDigestAsync(recipient, today.AddDays(-1), entries);
				}
				catch (Exception ex)
				{
					// Bir alıcıya gidememesi diğerlerini engellemesin.
					_logger.LogError(ex, "Admin kayıt özeti {Email} adresine gönderilemedi", recipient);
				}
			}

			_lastSentDay = today;
			_logger.LogInformation("Admin kayıt özeti gönderildi: {Count} yeni üye, {Recipients} alıcı", entries.Count, recipients.Length);
		}

		/// <summary>Verilen UTC gününde (00:00 dahil – ertesi 00:00 hariç) kaydolan üyeleri döner.</summary>
		public static async Task<List<SignupDigestEntry>> CollectSignupsAsync(AppDbContext db, DateOnly day, CancellationToken ct = default)
		{
			var from = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
			var to = day.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

			var users = await db.Users
				.IgnoreQueryFilters() // dün kaydolup hesabını hemen silen kullanıcı da özette görünmeli
				.Where(u => u.CreatedAt >= from && u.CreatedAt < to)
				.OrderBy(u => u.CreatedAt)
				.Select(u => new { u.Name, u.Email, u.CreatedAt, u.IsEmailVerified, u.PasswordHash, u.DeletedAt })
				.AsNoTracking()
				.ToListAsync(ct);

			return users.Select(u => new SignupDigestEntry(
				u.Name,
				u.Email,
				u.CreatedAt,
				u.IsEmailVerified,
				// Google/Apple ile açılan hesaplarda şifre alanı boş kalıyor; hangi sağlayıcı
				// olduğu saklanmadığı için ayrım "sosyal" düzeyinde kalıyor.
				Provider: (string.IsNullOrEmpty(u.PasswordHash) ? "sosyal" : "e-posta")
					+ (u.DeletedAt != null ? " · silindi" : "")
			)).ToList();
		}
	}
}
