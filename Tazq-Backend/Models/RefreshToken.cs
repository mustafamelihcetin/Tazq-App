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

		[ForeignKey("UserId")]
		public User User { get; set; } = null!;
	}
}
