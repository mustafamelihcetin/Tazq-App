// This converter highlights tasks that are due today and not completed.
using System;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Converters
{
    // This converter only needs one bound value and uses the converter parameter
    // to receive completion state so it can be used with the standard Binding
    // markup extension. Implement IValueConverter to match the Binding. The
    // parameter is expected to be a boolean value representing IsCompleted.
    public class DueTodayHighlightMultiConverter : IValueConverter
    {
        public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            bool isToday = value is bool b && b;
            bool isCompleted = parameter is bool p && p;

            if (isToday && !isCompleted)
                return Color.FromArgb("#90CAF9");
            if (isCompleted)
                return Color.FromArgb("#D0D0D0");
            return Color.FromArgb("#FFFFFF");
        }
        public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }

}
