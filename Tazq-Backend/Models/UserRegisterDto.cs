using System.ComponentModel.DataAnnotations;

namespace Tazq_App.Models
{
	public class UserRegisterDto
	{
		[Required, EmailAddress]
		public string Email { get; set; } = string.Empty;

		[Required]
		public string Name { get; set; } = string.Empty; // Full name in one field

		[Required, MinLength(6)]
		public string Password { get; set; } = string.Empty;
	}

	public class UserLoginDto
	{
		[Required, EmailAddress]
		public string Email { get; set; } = string.Empty;

		[Required]
		public string Password { get; set; } = string.Empty;
	}
}
