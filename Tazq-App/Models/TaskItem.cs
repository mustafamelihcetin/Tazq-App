using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace Tazq_App.Models
{
	public class TaskItem
	{
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime DueDate { get; set; }
        public bool IsCompleted { get; set; } = false;
        public TaskPriority Priority { get; set; } = TaskPriority.Medium;

        [ForeignKey("User")]
		public int UserId { get; set; }
        public User User { get; set; } // Navigation Property
	}
    public enum TaskPriority
    {
        Low,
        Medium,
        High
    }
}
