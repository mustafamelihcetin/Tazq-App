using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tazq_App.Models
{
	// Uzun ömürlü, DB-destekli yenileme token'ı. Ham token istemcide saklanır;
	// burada yalnızca SHA-256 hash'i tutulur. Her kullanımda rotasyona girer (revoke + yeni).
	public class RefreshToken
	{
		[Key]
		public int Id { get; set; }

		[Required]
		public int UserId { get; set; }

		[Required]
		public string TokenHash { get; set; } = string.Empty;

		public DateTime ExpiresAt { get; set; }

		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

		public DateTime? RevokedAt { get; set; }

		// Bir girişin rotasyon zinciri: her giriş yeni aile, her yenileme aynı aile. Yeniden kullanımda yalnız bu aile kapanır, başka cihaz etkilenmez.
		// Sütundan önce üretilmiş kayıtlarda boştur: o kayıt yalnız kendisi reddedilir.
		[MaxLength(32)]
		public string? FamilyId { get; set; }

		[ForeignKey("UserId")]
		public User User { get; set; } = null!;
	}
}
