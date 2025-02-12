using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

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
		public string PasswordHash { get; set; } = string.Empty;
		public List<TaskItem> Tasks { get; set; } = new List<TaskItem>();
	}
}
