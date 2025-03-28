using System;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Converters
{
	public class PriorityToColorConverter : IValueConverter
	{
		// Converts integer priority to color.
		public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
		{
			if (value is int priority)
			{
				return priority switch
				{
					0 => Color.FromArgb("#A8D5BA"), // Low
					1 => Color.FromArgb("#FFE9A0"), // Medium
					2 => Color.FromArgb("#F4A6A6"), // High
					_ => Color.FromArgb("#D3D3D3")
				};
			}

			return Color.FromArgb("#D3D3D3");
		}

		public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) => throw new NotImplementedException();
	}
}