using System;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Converters
{
    public class IsCompletedToIconConverter : IValueConverter
    {
        // Converts true/false to theme aware checkmark or empty box icon
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            bool isLightTheme = Application.Current.UserAppTheme == AppTheme.Unspecified
               ? Application.Current.RequestedTheme == AppTheme.Light
               : Application.Current.UserAppTheme == AppTheme.Light;

            string suffix = isLightTheme ? "_light.png" : "_dark.png";

            if (value is bool isCompleted)
            {
                return isCompleted
                    ? $"check_filled{suffix}"
                    : $"check_outline{suffix}";
            }
            return $"check_outline{suffix}";
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
            throw new NotImplementedException();
    }
}