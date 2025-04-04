using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Tazq_App.Models
{
	public class TaskItem
	{
		[Key]
		[DatabaseGenerated(DatabaseGeneratedOption.Identity)]
		public int Id { get; set; }

		[Required]
		public string Title { get; set; } = string.Empty;

		public string Description { get; set; } = string.Empty;

		public DateTime DueDate { get; set; }
        public DateTime? DueTime { get; set; }

        public bool IsCompleted { get; set; } = false;

		// Removed [JsonConverter] to accept integer from frontend
		public TaskPriority Priority { get; set; } = TaskPriority.Medium;

		[ForeignKey("User")]
		public int UserId { get; set; }

		[JsonIgnore]
		public User? User { get; set; }

		[Column(TypeName = "TEXT")]
		[JsonIgnore]
		public string TagsJson { get; set; } = "[]";

		[NotMapped]
		[JsonPropertyName("tags")]
		[JsonConverter(typeof(JsonStringListConverter))]
		public List<string> Tags
		{
			get
			{
				try
				{
					// Ensure empty JSON array is default
					if (string.IsNullOrWhiteSpace(TagsJson))
						TagsJson = "[]";

					return JsonSerializer.Deserialize<List<string>>(TagsJson) ?? new List<string>();
				}
				catch (JsonException)
				{
					return new List<string>();
				}
			}
			set
			{
				// Ensure always valid JSON, even for null lists
				TagsJson = JsonSerializer.Serialize(value ?? new List<string>());
			}
		}
	}
}