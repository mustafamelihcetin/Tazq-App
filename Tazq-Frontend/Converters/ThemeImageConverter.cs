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
            if (value is bool isLight)
            {
                string fileName = isLight ? Light : Dark;
                return ImageSource.FromFile(fileName + ".png");
            }

            // fallback
            return ImageSource.FromFile(Light + ".png");
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}