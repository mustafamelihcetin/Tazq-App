using System;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Globalization;

public class DateTimeConverterUsingDateOnly : JsonConverter<DateTime?>
{
	private const string Format = "yyyy-MM-dd";

	public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
	{
		var value = reader.GetString();
		if (DateTime.TryParseExact(value, Format, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
			return date;
		return null;
	}

	public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
	{
		writer.WriteStringValue(value?.ToString(Format));
	}
}