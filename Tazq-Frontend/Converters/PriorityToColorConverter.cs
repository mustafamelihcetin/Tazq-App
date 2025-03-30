﻿using System;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Converters
{
    public class PriorityToColorConverter : IValueConverter
    {
        // Converts the priority integer value to a color representation
        public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            if (value is int priority)
            {
                return priority switch
                {
                    0 => Color.FromArgb("#4CAF50"), // Düşük - Yeşil
                    1 => Color.FromArgb("#FFC107"), // Orta - Sarı
                    2 => Color.FromArgb("#F44336"), // Yüksek - Kırmızı
                    _ => Colors.Gray
                };
            }

            return Colors.Gray;
        }

        // Converts the color back to priority integer (optional, not used)
        public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}