using System;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Converters
{
    public class PriorityLevelToColorConverter : IValueConverter
    {
        // Converts priority level ("low", "medium", "high") to background color
        public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            return value?.ToString()?.ToLower() switch
            {
                "low" => Color.FromArgb("#4CAF50"),     // Green
                "medium" => Color.FromArgb("#FF9800"),  // Orange
                "high" => Color.FromArgb("#F44336"),    // Red
                _ => Color.FromArgb("#757575")          // Gray
            };
        }

        public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}