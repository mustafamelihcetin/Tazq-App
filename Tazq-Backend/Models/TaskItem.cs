using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Tazq_App.Models
{
	[JsonConverter(typeof(JsonStringEnumConverter))]
	public enum RecurrenceType
	{
		None,
		Daily,
		Weekly,
		Monthly
	}

	public class SubtaskItem
	{
		[JsonPropertyName("text")]
		public string Text { get; set; } = string.Empty;
		[JsonPropertyName("done")]
		public bool Done { get; set; } = false;
	}

	public class TaskItem
	{
		[Key]
		[DatabaseGenerated(DatabaseGeneratedOption.Identity)]
		public int Id { get; set; }

		[Required]
		[MaxLength(150)]
		public string Title { get; set; } = string.Empty;

		[MaxLength(1000)]
		public string Description { get; set; } = string.Empty;

		public DateTime? DueDate { get; set; }
        public DateTime? DueTime { get; set; }

        public bool IsCompleted { get; set; } = false;

		// Removed [JsonConverter] to accept integer from frontend
		public TaskPriority Priority { get; set; } = TaskPriority.Medium;

		// Recurring task support
		public RecurrenceType Recurrence { get; set; } = RecurrenceType.None;

		// Manual sort order (lower = higher in list)
		public int SortOrder { get; set; } = 0;

		// İstemci tarafı idempotency anahtarı (plaintext, deterministik hash).
		// Plan/günlük görevler için istemci aynı görevi (mod|gün|başlık) için aynı
		// ClientKey'i gönderir; sunucu aynı kullanıcıda tamamlanmamış aynı ClientKey'li
		// görev varsa yenisini OLUŞTURMAZ, mevcudu döndürür. Bu, ağ kopması/timeout
		// sonrası tekrar denemelerde (offline kuyruğu) çift kaydı kökten önler.
		// Şifrelenmez (içerik değil, düşük-entropili bir parmak izidir) ki DB'de
		// sorgulanabilsin.
		[MaxLength(64)]
		public string? ClientKey { get; set; }

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
				TagsJson = JsonSerializer.Serialize(value ?? new List<string>());
			}
		}

		[Column(TypeName = "TEXT")]
		[JsonIgnore]
		public string SubtasksJson { get; set; } = "[]";

		[NotMapped]
		[JsonPropertyName("subtasks")]
		public List<SubtaskItem> Subtasks
		{
			get
			{
				try
				{
					if (string.IsNullOrWhiteSpace(SubtasksJson))
						SubtasksJson = "[]";
					return JsonSerializer.Deserialize<List<SubtaskItem>>(SubtasksJson) ?? new List<SubtaskItem>();
				}
				catch (JsonException)
				{
					return new List<SubtaskItem>();
				}
			}
			set
			{
				SubtasksJson = JsonSerializer.Serialize(value ?? new List<SubtaskItem>());
			}
		}
	}
}