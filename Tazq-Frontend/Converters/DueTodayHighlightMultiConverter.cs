// This converter highlights tasks that are due today and not completed.
using System;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Converters
{
    public class DueTodayHighlightMultiConverter : IMultiValueConverter
    {
        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            bool isToday = (bool)values[0];
            bool isCompleted = (bool)values[1];

            if (isToday && !isCompleted)
                return Color.FromArgb("#90CAF9");
            else if (isCompleted)
                return Color.FromArgb("#D0D0D0");
            else
                return Color.FromArgb("#FFFFFF");
        }
        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }

}
