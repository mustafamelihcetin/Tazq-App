using System.ComponentModel.DataAnnotations;

namespace Tazq_App.Models
{
	public class PhoneNumberDto
	{
		[Required]
		[RegularExpression(@"^\+\d{1,15}$", ErrorMessage = "Phone number must be in international format (e.g., +1234567890).")]
		public string PhoneNumber { get; set; } = string.Empty;
	}
}
