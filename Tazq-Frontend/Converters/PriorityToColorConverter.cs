// Converts Priority (e.g., Low, Medium, High) into a corresponding Color.
using System;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Converters
{
	public class PriorityToColorConverter : IValueConverter
	{
		public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
		{
			if (value is not string priority)
				return Colors.Gray;

			return priority.ToLower() switch
			{
				"low" => Colors.Green,
				"medium" => Colors.Orange,
				"high" => Colors.Red,
				_ => Colors.Gray
			};
		}

		public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
		{
			throw new NotImplementedException();
		}
	}
}
