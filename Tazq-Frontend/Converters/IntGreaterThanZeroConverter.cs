﻿using System;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Converters
{
	public class IntGreaterThanZeroConverter : IValueConverter
	{
		// Visibility based on int > 0 (used for Tags count)
		public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
		{
			if (value is int number)
			{
				return number > 0;
			}

			return false;
		}

		public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) => throw new NotImplementedException();
	}
}