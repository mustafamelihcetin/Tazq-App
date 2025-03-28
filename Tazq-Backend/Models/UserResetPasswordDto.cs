// Represents the reset password request payload.
using System.ComponentModel.DataAnnotations;

namespace Tazq_App.Models
{
	public class UserResetPasswordDto
	{
		[Required]
		public string Token { get; set; } = string.Empty;

		[Required]
		public string NewPassword { get; set; } = string.Empty;
	}
}