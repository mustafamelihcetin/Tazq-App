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

		[JsonIgnore]
		public List<TaskItem> Tasks { get; set; } = new List<TaskItem>();
        public string? LastLoginIp { get; set; }

    }
}
