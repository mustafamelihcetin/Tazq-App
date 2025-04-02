using System;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Converters
{
    public class PriorityToTurkishConverter : IValueConverter
    {
        public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            if (value is int priority)
            {
                return priority switch
                {
                    1 => "Düşük",
                    2 => "Orta",
                    3 => "Yüksek",
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