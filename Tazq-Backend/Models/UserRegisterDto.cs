using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Tazq_App.Models
{
	public class UserRegisterDto
	{
		[Required, EmailAddress]
		[JsonPropertyName("email")]
		public string Email { get; set; } = string.Empty;

		[Required]
		[JsonPropertyName("name")]
		public string Name { get; set; } = string.Empty; // Full name in one field

		[Required, MinLength(6)]
		[JsonPropertyName("password")]
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
