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
                    TaskPriority.Low => Color.FromArgb("#81C784"),     // Düşük - soft yeşil
                    TaskPriority.Medium => Color.FromArgb("#FFD54F"),  // Orta - soft sarı
                    TaskPriority.High => Color.FromArgb("#EF5350"),    // Yüksek - pastel kırmızı
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