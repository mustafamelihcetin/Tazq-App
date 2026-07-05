using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Tazq_App.Models
{
	public class User
	{
		[Key]
		[DatabaseGenerated(DatabaseGeneratedOption.Identity)]
		public int Id { get; set; }

		[Required, EmailAddress]
		public string Email { get; set; } = string.Empty;

		[Required]
		public string Name { get; set; } = string.Empty; // Full name (first + last name)

		public string? PasswordHash { get; set; } // Base64 encoded SHA-512 hash

		public string? PasswordSalt { get; set; } // Base64 encoded Salt

		[Required]
		public string Role { get; set; } = "User"; // Default user role

		public string? PhoneNumber { get; set; } // Optional phone number

		public bool IsPhoneVerified { get; set; } = false; // Phone verification status
														   // Notification preferences for the user
		public UserNotificationPreferences? NotificationPreferences { get; set; }


		public string? ProfilePicture { get; set; } // Optional profile picture URL

		[MaxLength(150)]
		public string? Motto { get; set; } // Kişisel motto / kısa not

		[MaxLength(32)]
		public string? AvatarBorderColor { get; set; } // Profil avatar çerçeve rengi (hex)

		// Cihazlar arası eşitlenen kullanıcı tercihleri (mod seçimleri, planlar, üretkenlik saati vb.)
		// JSON string olarak tutulur; şema frontend usePrefsStore tarafından yönetilir.
		public string? Preferences { get; set; }

		public bool IsBanned { get; set; } = false; // Kalıcı ban (admin). Süreli ban için BannedUntil kullanılır.

		// Süreli ban bitiş zamanı (UTC). null = süreli ban yok. Süre dolunca kullanıcı tekrar giriş yapabilir.
		public DateTime? BannedUntil { get; set; }

		// Aktif banın sebebi (hızlı gösterim için). Ban kaldırılınca temizlenir. Tam geçmiş BanHistory'de.
		[MaxLength(200)]
		public string? BanReason { get; set; }

		// O an banlı mı? Kalıcı ban VEYA süresi henüz dolmamış geçici ban. (Sorguya çevrilmez, bellekte kullanılır.)
		[NotMapped]
		public bool IsCurrentlyBanned => IsBanned || (BannedUntil.HasValue && BannedUntil.Value > DateTime.UtcNow);

		[JsonIgnore]
		public List<TaskItem> Tasks { get; set; } = new List<TaskItem>();
        public string? LastLoginIp { get; set; }

        // Soft-delete: hesap silindiğinde işaretlenir. Grace period içinde tekrar giriş = reaktivasyon;
        // süre dolunca arka plan servisi kalıcı olarak siler. null = aktif hesap.
        public DateTime? DeletedAt { get; set; }

        // E-posta doğrulama. Google/Apple ile girenlerde sağlayıcı doğruladığı için true;
        // e-posta/şifre kaydında kod girilene kadar false.
        public bool IsEmailVerified { get; set; } = false;
        public string? EmailVerificationCode { get; set; }
        public DateTime? EmailVerificationExpiresAt { get; set; }

    }
}
