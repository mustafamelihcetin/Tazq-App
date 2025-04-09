using System;
using System.Globalization;
using Microsoft.Maui.Controls;
using Tazq_Frontend.Models;

namespace Tazq_Frontend.Converters
{
    public class PriorityToColorConverter : IValueConverter
    {
        // Converts the TaskPriority enum to a soft theme-compatible color
        public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            if (value is TaskPriority priority)
            {
                return priority switch
                {
                    TaskPriority.Low => Color.FromArgb("#2E86C1"),      // Koyu mavi
                    TaskPriority.Medium => Color.FromArgb("#B7950B"),   // Koyu sarı
                    TaskPriority.High => Color.FromArgb("#922B21"),     // Koyu kırmızı
                    _ => Colors.Gray
                };
            }

            return Colors.Gray;
        }

        public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}