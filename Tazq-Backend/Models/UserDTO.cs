using System.ComponentModel.DataAnnotations;

namespace Tazq_App.Models
{
	public class UserRegisterDto
	{
		[Required]
		public string Username { get; set; } = string.Empty;

		[Required, EmailAddress]
		public string Email { get; set; } = string.Empty;

		[Required, MinLength(6)]
		public string Password { get; set; } = string.Empty;
	}

	public class UserLoginDto
	{
		[Required]
		public string Username { get; set; } = string.Empty;

		[Required]
		public string Password { get; set; } = string.Empty;
	}
}
