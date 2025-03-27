using System.Text.Json;
using System.Text.Json.Serialization;

namespace Tazq_App.Models
{
	public class JsonStringListConverter : JsonConverter<List<string>>
	{
		public override List<string> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
		{
			try
			{
				return JsonSerializer.Deserialize<List<string>>(ref reader, options) ?? new List<string>();
			}
			catch (JsonException)
			{
				return new List<string>(); 
			}
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
