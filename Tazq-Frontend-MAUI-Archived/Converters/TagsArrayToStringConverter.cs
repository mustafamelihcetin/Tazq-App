using System;
using System.Globalization;
using Microsoft.Maui.Controls;
using System.Linq;
using System.Collections.Generic;

namespace Tazq_Frontend.Converters
{
	public class TagsArrayToStringConverter : IValueConverter
	{
		public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
		{
			if (value is IEnumerable<string> tags)
			{
				return string.Join(", ", tags);
			}

			return string.Empty;
		}

		public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
		{
			throw new NotImplementedException();
		}
	}
}