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

		[Required]
		public string Username { get; set; } = string.Empty;

		[Required, EmailAddress]
		public string Email { get; set; } = string.Empty;

		[Required]
		public byte[] PasswordHash { get; set; } = new byte[0];

		[Required]
		public byte[] PasswordSalt { get; set; } = new byte[0];

		[Required]
		public string Role { get; set; } = "User"; // Default role

		[JsonIgnore]
		public List<TaskItem> Tasks { get; set; } = new List<TaskItem>();
	}
}
