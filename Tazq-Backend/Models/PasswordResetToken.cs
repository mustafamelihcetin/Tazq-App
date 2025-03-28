// Represents a token used for resetting user password.
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tazq_App.Models
{
	public class PasswordResetToken
	{
		[Key]
		public int Id { get; set; }

		[Required]
		public int UserId { get; set; }

		[Required]
		public string Token { get; set; } = string.Empty;

		public DateTime Expiration { get; set; }

		[ForeignKey("UserId")]
		public User User { get; set; } = null!;
	}
}