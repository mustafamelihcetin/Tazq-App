using System;

namespace Tazq_Frontend.Models
{
	public class TaskModel
	{
		public int Id { get; set; }
		public string Title { get; set; } = string.Empty;
		public string? Description { get; set; }
		public DateTime? DueDate { get; set; }
		public bool IsCompleted { get; set; }
		public string Priority { get; set; } = string.Empty;
		public string[] Tags { get; set; } = Array.Empty<string>();
	}
}