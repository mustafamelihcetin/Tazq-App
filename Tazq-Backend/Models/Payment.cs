using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Tazq_App.Models
{
	[JsonConverter(typeof(JsonStringEnumConverter))]
	public enum PaymentRecurrence
	{
		Once,
		Monthly,
		Yearly
	}

	/// <summary>
	/// Ödeme takibi — GÖREVLERDEN TAMAMEN AYRI bir yüzey. Hiçbir zaman TaskItem
	/// oluşturmaz, TaskService'i çağırmaz, NLP ayrıştırıcıya veya günlük plan
	/// motoruna girmez. Eski `features/wallet/utils/syncSubscriptions.ts` bunu
	/// yapıyordu (abonelikleri gerçek görev olarak materyalize ediyordu) ve
	/// bu, özelliğin terk edilme sebebiydi — kasıtlı olarak tekrarlanmıyor.
	/// </summary>
	public class Payment
	{
		[Key]
		[DatabaseGenerated(DatabaseGeneratedOption.Identity)]
		public int Id { get; set; }

		[ForeignKey("User")]
		public int UserId { get; set; }

		[JsonIgnore]
		public User? User { get; set; }

		/// <summary>
		/// 2026-11-01: ŞİFRELİ saklanır (kullanıcı anahtarı, AES-GCM) — "kredi kartı", "kira" gibi başlıklar kişisel.
		/// Sütun şifreli metni taşıyacak genişlikte (512); düz metin sınırı serviste 100 (PaymentService.MaxTitleLength).
		/// </summary>
		[Required]
		[MaxLength(512)]
		public string Title { get; set; } = string.Empty;

		public decimal Amount { get; set; }

		/// <summary>Ayın hangi günü vadesi geliyor (1-31). Ay o günden kısaysa son gün kullanılır.</summary>
		[Range(1, 31)]
		public int DueDay { get; set; }

		public PaymentRecurrence Recurrence { get; set; } = PaymentRecurrence.Monthly;

		/// <summary>Tek seferlik ödemenin kesin tarihi (Recurrence=Once'ta kullanılır).</summary>
		public DateTime? NextDueDate { get; set; }

		/// <summary>
		/// "Bu dönem ödendi mi" — ayrı bir habit/task YOK, tek bir alan.
		/// Aylık için "YYYY-MM", yıllık için "YYYY", tek seferlik için sabit "once".
		/// Dönem değişince (yeni ay/yıl) otomatik olarak "ödenmemiş" sayılır — alan
		/// sıfırlanmaz, yalnız karşılaştırma dönemi artık eşleşmez.
		/// </summary>
		[MaxLength(16)]
		public string? LastPaidCycleKey { get; set; }

		/// <summary>
		/// Bu dönem ödenmedi, atlandı (abonelik dondu, kira başka yoldan ödendi). `LastPaidCycleKey` de aynı dönemi taşır ki
		/// hatırlatma ve vade sonraki döneme geçsin; bu alan eşitse o dönem "ödendi" sayılmaz, geçmişe kayıt yazılmaz.
		/// </summary>
		[MaxLength(16)]
		public string? LastSkippedCycleKey { get; set; }

		[MaxLength(40)]
		public string? Category { get; set; }

		/// <summary>
		/// ISO 4217 (TRY/USD/EUR/GBP). null = kullanıcının ana para birimi. Eskiden tek
		/// global tercih vardı; 200 ₺ kira, 20 $ abonelik ve 100 € spor salonu aynı listede
		/// yaşayamıyordu (madde 12).
		/// </summary>
		[MaxLength(3)]
		public string? Currency { get; set; }

		/// <summary>
		/// TUTAR HER AY DEĞİŞİR (elektrik, doğalgaz, kart ekstresi — 2026-11-01). Doğruysa `Amount` bir TAHMİNDİR
		/// (son ödenen tutar); "ödendi" işaretinde o ayın gerçek tutarı alınır ve geçmişe o yazılır.
		/// </summary>
		public bool IsVariable { get; set; }

		/// <summary>TAKSİT: toplam taksit sayısı (2–120). null = süresiz. Son taksitten sonra ödeme "bitti" sayılır.</summary>
		public int? InstallmentCount { get; set; }

		/// <summary>İlk taksitin dönemi ("YYYY-MM"; yıllıkta "YYYY"). Kalan taksit buradan hesaplanır.</summary>
		[MaxLength(7)]
		public string? InstallmentStart { get; set; }

		/// <summary>Kullanıcının seçtiği ikon anahtarı (istemci sözlüğü); null = başlıktan tahmin.</summary>
		[MaxLength(16)]
		public string? Icon { get; set; }

		/// <summary>Kullanıcının seçtiği renk ("#RRGGBB"); null = varsayılan.</summary>
		[MaxLength(7)]
		public string? Color { get; set; }

		/// <summary>Vadeden kaç gün önce hatırlatılır: 0 aynı gün, -1 kapalı, null = varsayılan (3).</summary>
		public int? ReminderDays { get; set; }

		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
	}

	/// <summary>
	/// ÖDEME GEÇMİŞİ — her "ödendi" işareti bir kayıt. Eskiden yalnız LastPaidCycleKey
	/// vardı; ay değişince geçen ayın ödemesi hiçbir yerde kalmıyordu. Başlık, tutar ve
	/// birim o ANIN fotoğrafıdır: ödeme sonradan değişse/silinse de geçmiş doğru kalır.
	/// </summary>
	[Microsoft.EntityFrameworkCore.Index(nameof(UserId), nameof(PaidAt))] // geçmiş sorgusu: kullanıcı + tarih penceresi
	public class PaymentRecord
	{
		[Key]
		[DatabaseGenerated(DatabaseGeneratedOption.Identity)]
		public int Id { get; set; }

		public int UserId { get; set; }

		/// <summary>Ödeme silinince null (geçmiş korunur).</summary>
		public int? PaymentId { get; set; }

		/// <summary>Ödemenin başlığıyla aynı biçimde ŞİFRELİ (anın fotoğrafı; bkz. Payment.Title).</summary>
		[Required]
		[MaxLength(512)]
		public string Title { get; set; } = string.Empty;

		public decimal Amount { get; set; }

		[MaxLength(3)]
		public string? Currency { get; set; }

		[MaxLength(16)]
		public string CycleKey { get; set; } = string.Empty;

		public DateTime PaidAt { get; set; } = DateTime.UtcNow;
	}
}
