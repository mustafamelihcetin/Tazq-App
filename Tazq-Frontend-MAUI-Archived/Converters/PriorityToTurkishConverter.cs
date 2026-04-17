using System;
using System.Globalization;
using Microsoft.Maui.Controls;
using Tazq_Frontend.Models;

namespace Tazq_Frontend.Converters
{
    public class PriorityToTurkishConverter : IValueConverter
    {
        public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            if (value is TaskPriority priority)
            {
                return priority switch
                {
                    TaskPriority.Low => "Düşük",
                    TaskPriority.Medium => "Orta",
                    TaskPriority.High => "Yüksek",
                    _ => "Bilinmeyen"
                };
            }

            return "Bilinmeyen";
        }

        public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            return null;
        }
    }
}