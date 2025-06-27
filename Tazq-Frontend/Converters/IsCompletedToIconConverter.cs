using System;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Converters
{
    public class IsCompletedToIconConverter : IValueConverter
    {
        // Converts true/false to theme aware checkmark or empty box icon
        public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {           

            if (value is bool isCompleted)
            {
                return isCompleted
                    ? "check_filled.png"
                    : "check_outline.png";
            }
            return "check_outline.png";
        }

        public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
            throw new NotImplementedException();
    }
}