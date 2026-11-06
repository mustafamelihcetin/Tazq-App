using System.Text.Json.Nodes;

namespace Tazq_App.Services
{
	/// <summary>
	/// SUNUCU DURUMU (2026-11-06). Olcumu host'taki bakim betigi yapar (ops/tazq-maint.py), kapsayiciya salt okunur baglanan dosyaya yazar: kapsayici diski ve Docker'i goremez,
	/// goremeyecek yetkide de kalmali. Burasi dosyayi okur ve betigin kendisi durduysa bunu soyler: sessiz bozulan kontrol, kontrolsuzlukten kotudur.
	/// </summary>
	public static class ServerStatus
	{
		public const string DefaultPath = "/app/status/status.json";
		public static readonly TimeSpan StaleAfter = TimeSpan.FromMinutes(15);

		public static string PathFromEnv => Environment.GetEnvironmentVariable("SERVER_STATUS_PATH") ?? DefaultPath;

		/// <summary>Olcum + uyari kodlari. Dosya yoksa ya da okunamazsa yalniz 'status_missing'; bayatsa 'status_stale' eklenir.</summary>
		public static JsonObject Read(string path, DateTime utcNow)
		{
			JsonObject? data = null;
			try { data = File.Exists(path) ? JsonNode.Parse(File.ReadAllText(path)) as JsonObject : null; }
			catch (Exception e) when (e is IOException or UnauthorizedAccessException or System.Text.Json.JsonException) { data = null; }

			if (data is null) return new JsonObject { ["available"] = false, ["warnings"] = new JsonArray("status_missing") };

			var warnings = data["warnings"] as JsonArray ?? new JsonArray();
			var at = DateTime.TryParse(data["at"]?.GetValue<string>(), null, System.Globalization.DateTimeStyles.AdjustToUniversal, out var parsed) ? parsed : DateTime.MinValue;
			var stale = utcNow - at > StaleAfter;
			if (stale) warnings.Add("status_stale");
			data["warnings"] = warnings.DeepClone();
			data["available"] = true;
			data["stale"] = stale;
			return data;
		}

		/// <summary>Ölçüm + kötüye kullanım özeti: panel ve e-posta aynı cevabı versin.</summary>
		public static JsonObject ReadWithAbuse(AbuseGuard guard, DateTime utcNow)
		{
			var status = Read(PathFromEnv, utcNow);
			var abuse = guard.Snapshot();
			status["abuse"] = abuse;
			if (abuse["blocksLastHour"]!.GetValue<int>() > 0 || abuse["blockedNow"]!.GetValue<int>() > 0)
				(status["warnings"] as JsonArray)?.Add("abuse_detected");
			return status;
		}

		public static IReadOnlyList<string> WarningsOf(JsonObject status) =>
			(status["warnings"] as JsonArray)?.Select(w => w?.GetValue<string>()).OfType<string>().ToList() ?? new List<string>();

		/// <summary>Bildirimde gidecek metin: e-postaya olcum degeri koymak yerine ne yapilacagini soyler.</summary>
		public static string Describe(string code) => code switch
		{
			"disk_critical" => "Disk %90'i gecti. Veritabani yazamaz hale gelebilir.",
			"disk_high" => "Disk %80'i gecti.",
			"disk_filling" => "Disk mevcut hizla 14 gunden kisa surede dolacak.",
			"memory_high" => "Bellek %90'i gecti.",
			"cpu_high" => "Islemci yuku surekli yuksek.",
			"container_down" => "Bir servis calismiyor ya da sagliksiz.",
			"backup_late" => "Son 26 saatte sunucu yedegi alinamadi.",
			"cloud_backup_late" => "Son 26 saatte bulut yedegi gonderilemedi.",
			"cloud_backup_skipped" => "Bulut yedegi boyut sinirina takildi, gonderilmiyor.",
			"status_stale" => "Bakim betigi 15 dakikadir olcum yazmiyor.",
			"status_missing" => "Durum dosyasi okunamiyor.",
			"abuse_detected" => "Son bir saatte asiri istek gonderen bir kaynak gecici olarak engellendi. Saldiri olabilir; Sistem sekmesinden kayitlara bak.",
			_ => code,
		};
	}

	/// <summary>Uyari cikinca admin'e e-posta. Ayni uyari gunde bir kez: panelde sessizce duran sorun kimseye ulasmaz, her turda mail de okunmaz.</summary>
	public class ServerWatchService : BackgroundService
	{
		private readonly IServiceProvider _services;
		private readonly ILogger<ServerWatchService> _logger;
		private readonly JobHealth _health;
		private readonly WatchMemory _memory = new();
		private readonly AbuseGuard _guard;

		public ServerWatchService(IServiceProvider services, ILogger<ServerWatchService> logger, JobHealth health, AbuseGuard guard)
		{
			_guard = guard;
			_services = services;
			_logger = logger;
			_health = health;
			_health.Register(JobHealth.ServerWatch, TimeSpan.FromMinutes(15));
		}

		private static string[] Recipients =>
			new[] { Environment.GetEnvironmentVariable("ADMIN_EMAIL") ?? "" }
				.Concat((Environment.GetEnvironmentVariable("ADMIN_EMAILS") ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
				.Where(e => !string.IsNullOrWhiteSpace(e)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

		protected override async Task ExecuteAsync(CancellationToken stoppingToken)
		{
			// Acilista olcumun tazelenmesine firsat: deploy sirasinda yanlis alarm olmasin.
			try { await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken); } catch (OperationCanceledException) { return; }
			while (!stoppingToken.IsCancellationRequested)
			{
				try
				{
					var fresh = _memory.Due(ServerStatus.WarningsOf(ServerStatus.ReadWithAbuse(_guard, DateTime.UtcNow)), DateTime.UtcNow);
					if (fresh.Count > 0 && Recipients.Length > 0)
					{
						using var scope = _services.CreateScope();
						var mail = scope.ServiceProvider.GetRequiredService<ICustomEmailService>();
						var body = "<p>TAZQ sunucusunda dikkat gerektiren durum:</p><ul>" + string.Concat(fresh.Select(c => $"<li>{ServerStatus.Describe(c)}</li>")) + "</ul><p>Ayrinti: Admin paneli, Sistem sekmesi.</p>";
						foreach (var to in Recipients) await mail.SendEmailAsync(to, "TAZQ sunucu uyarisi", body);
					}
					_health.Ok(JobHealth.ServerWatch);
				}
				catch (Exception ex)
				{
					_logger.LogError(ex, "Sunucu durumu kontrol edilemedi");
					_health.Fail(JobHealth.ServerWatch, ex);
				}
				try { await Task.Delay(TimeSpan.FromMinutes(15), stoppingToken); } catch (OperationCanceledException) { return; }
			}
		}
	}

	/// <summary>Hangi uyari en son ne zaman bildirildi. Duzelen uyari unutulur: tekrar cikarsa hemen bildirilir.</summary>
	public sealed class WatchMemory
	{
		private readonly Dictionary<string, DateTime> _sent = new();
		private static readonly TimeSpan Cooldown = TimeSpan.FromHours(24);

		public IReadOnlyList<string> Due(IReadOnlyList<string> current, DateTime now)
		{
			foreach (var gone in _sent.Keys.Where(k => !current.Contains(k)).ToList()) _sent.Remove(gone);
			var due = current.Where(c => !_sent.TryGetValue(c, out var at) || now - at >= Cooldown).ToList();
			foreach (var c in due) _sent[c] = now;
			return due;
		}
	}
}
