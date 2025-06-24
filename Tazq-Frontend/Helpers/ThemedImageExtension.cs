// This markup extension selects image based on current app theme.
using Microsoft.Maui.Controls;
using Microsoft.Maui.Graphics;
using System;

namespace Tazq_Frontend.Helpers
{
    public class ThemedImageExtension : IMarkupExtension<ImageSource>
    {
        public string Light { get; set; }
        public string Dark { get; set; }

        public ImageSource ProvideValue(IServiceProvider serviceProvider)
        {
            var theme = Application.Current?.RequestedTheme ?? AppTheme.Unspecified;

            return theme switch
            {
                AppTheme.Light => Light,
                AppTheme.Dark => Dark,
                _ => Light
            };
        }

        object IMarkupExtension.ProvideValue(IServiceProvider serviceProvider)
            => ProvideValue(serviceProvider);
    }
}