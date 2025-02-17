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

		public bool IsCompleted { get; set; } = false;

		public TaskPriority Priority { get; set; } = TaskPriority.Medium;

		[ForeignKey("User")]
		public int UserId { get; set; }

		[JsonIgnore] // Prevents infinite recursion
		public User? User { get; set; }

		// Store tags as a JSON array in the database
		[Column(TypeName = "TEXT")]
		public string TagsJson { get; set; } = "[]";

		[NotMapped]
		[JsonPropertyName("tags")] // Ensures proper serialization
		[JsonConverter(typeof(JsonStringListConverter))] // Custom JSON Converter
		public List<string> Tags
		{
			get => string.IsNullOrEmpty(TagsJson) ? new List<string>() : JsonSerializer.Deserialize<List<string>>(TagsJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<string>();
			set => TagsJson = JsonSerializer.Serialize(value, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
		}
	}

	public enum TaskPriority
	{
		Low,
		Medium,
		High
	}

	// Custom JSON Converter for Tags List
	public class JsonStringListConverter : JsonConverter<List<string>>
	{
		public override List<string> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
		{
			return JsonSerializer.Deserialize<List<string>>(ref reader, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<string>();
		}

		public override void Write(Utf8JsonWriter writer, List<string> value, JsonSerializerOptions options)
		{
			writer.WriteStartArray();
			foreach (var item in value)
			{
				writer.WriteStringValue(item);
			}
			writer.WriteEndArray();
		}
	}
}
