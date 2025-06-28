using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Tazq_App.Models
{
	public class TaskRequestDto
	{
		[Required]
		public List<TaskDto> Tasks { get; set; } = new List<TaskDto>();
	}

    public class TaskDto
    {
        [Required]
		[MinLength(1)]
		public string Title { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;
        public DateTime DueDate { get; set; }
        public DateTime? DueTime { get; set; }
        public bool IsCompleted { get; set; } = false;

        [JsonConverter(typeof(JsonStringEnumConverter))]
		public TaskPriority Priority { get; set; } = TaskPriority.Medium;

		[JsonPropertyName("tags")]
		public List<string> Tags { get; set; } = new List<string>();
	}
}
