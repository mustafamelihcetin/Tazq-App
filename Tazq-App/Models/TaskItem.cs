using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tazq_App.Models
{
	public class TaskItem
	{
		[Key]
		[DatabaseGenerated(DatabaseGeneratedOption.Identity)]
		public int Id { get; set; }

		[Required]
		public string Title { get; set; } = string.Empty;

		public string? Description { get; set; }

		[Required]
		public DateTime DueDate { get; set; }

		[Required]
		public bool IsCompleted { get; set; }

		[Required]
		public TaskPriority Priority { get; set; }

		[Required]
		[ForeignKey("User")]
		public int UserId { get; set; }

		public User? User { get; set; } // Navigation property
	}

	public enum TaskPriority
	{
		Low = 1,
		Medium = 2,
		High = 3
	}
}
