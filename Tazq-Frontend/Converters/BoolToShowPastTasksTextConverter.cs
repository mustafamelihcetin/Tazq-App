using System;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Converters
{
    public class BoolToShowPastTasksTextConverter : IValueConverter
    {
        public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            Console.WriteLine($"[DEBUG] Converter input: {value}");
            if (value is bool show)
                return show ? "Geçmiş görevleri gizle" : "Geçmiş görevleri göster";
            return "Göster";
        }


        public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
            => throw new NotImplementedException();
    }
}