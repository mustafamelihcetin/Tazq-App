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

		[Required]
		[MaxLength(100)]
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

		[MaxLength(40)]
		public string? Category { get; set; }

		/// <summary>
		/// ISO 4217 (TRY/USD/EUR/GBP). null = kullanıcının ana para birimi. Eskiden tek
		/// global tercih vardı; 200 ₺ kira, 20 $ abonelik ve 100 € spor salonu aynı listede
		/// yaşayamıyordu (madde 12).
		/// </summary>
		[MaxLength(3)]
		public string? Currency { get; set; }

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

		[Required]
		[MaxLength(100)]
		public string Title { get; set; } = string.Empty;

		public decimal Amount { get; set; }

		[MaxLength(3)]
		public string? Currency { get; set; }

		[MaxLength(16)]
		public string CycleKey { get; set; } = string.Empty;

		public DateTime PaidAt { get; set; } = DateTime.UtcNow;
	}
}
