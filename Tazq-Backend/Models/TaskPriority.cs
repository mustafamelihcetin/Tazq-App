using System.Text.Json.Serialization;

namespace Tazq_App.Models
{
	[JsonConverter(typeof(JsonStringEnumConverter))]
	public enum TaskPriority
	{
		Low,
		Medium,
		High
	}
}
