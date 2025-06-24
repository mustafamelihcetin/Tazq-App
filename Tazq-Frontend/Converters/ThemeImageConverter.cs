using System;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Converters
{
    public class ThemeImageConverter : IValueConverter
    {
        public string Light { get; set; }
        public string Dark { get; set; }

        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            var currentTheme = Application.Current?.RequestedTheme ?? AppTheme.Light;

            return currentTheme == AppTheme.Dark ? Dark : Light;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}