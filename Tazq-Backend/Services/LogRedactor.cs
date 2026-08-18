using System.Text.RegularExpressions;

namespace Tazq_App.Services
{
	/// <summary>
	/// Admin panelinde görüntülenen log satırlarındaki hassas değerleri maskeler.
	///
	/// NEDEN BURADA (tek boğaz noktası): loglar admin panelinden SSH'siz okunabiliyor
	/// (InMemoryLogStore → AdminSystemController). Yani bir kaydın içine sızan e-posta
	/// ya da jeton, "sunucu logu" olmaktan çıkıp UYGULAMA İÇİNDEN OKUNABİLİR bir veri
	/// hâline geliyor. Maskelemeyi tek tek çağrı yerlerine serpiştirmek yerine kaydın
	/// depoya girdiği tek noktaya koymak, BUGÜN farkında olmadığımız ve YARIN eklenecek
	/// log satırlarını da kapsar.
	///
	/// Ölçülen sızıntılar: ScheduledEmailService ve UserService hata yollarında kullanıcı
	/// e-postasını logluyor. Ayrıca her istisna mesajı olduğu gibi ekleniyor — içinde bir
	/// URL ya da yetkilendirme başlığı varsa jeton da beraberinde geliyor.
	///
	/// KAPSAM BİLEREK DAR. Kredi kartı ve kimlik numarası desenleri EKLENMEDİ: bu
	/// uygulama ikisini de hiç toplamıyor, buna karşılık "13-19 haneli sayı" gibi bir
	/// desen zaman damgalarını ve kimlikleri yanlışlıkla maskeleyip logu teşhis için
	/// değersizleştirirdi. Maskeleme, okunabilirliği bozduğu ölçüde kendi amacını yer.
	///
	/// Maskeleme GERİ DÖNDÜRÜLEMEZ ve kaydın kendisine uygulanır; depoda ham hâli
	/// tutulmaz.
	/// </summary>
	public static class LogRedactor
	{
		// JWT: erişim ve yenileme jetonları. Üç base64url parça, "eyJ" ile başlar.
		private static readonly Regex JwtPattern = new(
			@"eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*",
			RegexOptions.Compiled);

		// "Bearer <değer>" — başlık bir istisna mesajına yankılandığında yakalar.
		private static readonly Regex BearerPattern = new(
			@"(?i)\bBearer\s+[A-Za-z0-9._\-+/=]{12,}",
			RegexOptions.Compiled);

		// token=... / password=... / code=... hem sorgu dizesi hem JSON biçiminde.
		// Şifre sıfırlama bağlantısı tam olarak bu biçimde taşınıyor.
		//
		// Ayırıcıdaki tırnaklar İSTEĞE BAĞLI ve İKİ YANDA: JSON'da anahtar `"password"`
		// diye kapanır, yani ad ile `:` arasına bir tırnak girer. İlk sürüm yalnız
		// `password=` biçimini yakalıyordu ve `{"password":"..."}` gövdesini olduğu gibi
		// geçiriyordu — testte yakalandı.
		private static readonly Regex SecretAssignmentPattern = new(
			@"(?i)\b(token|refreshtoken|password|passwordhash|apikey|api_key|secret|code)\b(\s*""?\s*[=:]\s*""?)([^\s""&,;}]{4,})",
			RegexOptions.Compiled);

		// E-posta: yerel kısım maskelenir, alan adı kalır (triyaj için gerekli).
		private static readonly Regex EmailPattern = new(
			@"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}",
			RegexOptions.Compiled);

		public static string Redact(string? message)
		{
			if (string.IsNullOrEmpty(message)) return string.Empty;

			var result = JwtPattern.Replace(message, "[jwt]");
			result = BearerPattern.Replace(result, "Bearer [gizlendi]");
			result = SecretAssignmentPattern.Replace(result, m => m.Groups[1].Value + m.Groups[2].Value + "[gizlendi]");
			result = EmailPattern.Replace(result, m => MaskEmail(m.Value));
			return result;
		}

		/// <summary>
		/// "melih@tazqapp.com" → "m***h@tazqapp.com".
		///
		/// Alan adı KORUNUR: bir hata dalgasının tek bir sağlayıcıda (ör. yalnız iCloud
		/// adreslerinde) toplandığını görmek teşhisin en hızlı yolu. Yerel kısmın ilk ve
		/// son karakteri, aynı kullanıcının tekrar eden hatalarını gözle eşleştirmeye
		/// yeter ama adresi yeniden kurmaya yetmez. İki karakterden kısa yerel kısımlarda
		/// hiçbir karakter gösterilmez — orada ipucu, adresin kendisi olurdu.
		/// </summary>
		private static string MaskEmail(string email)
		{
			var at = email.IndexOf('@');
			if (at <= 0) return "[eposta]";

			var local = email[..at];
			var domain = email[at..];

			if (local.Length <= 2) return new string('*', local.Length) + domain;
			return $"{local[0]}***{local[^1]}{domain}";
		}
	}
}
