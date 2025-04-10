﻿using Microsoft.Extensions.Logging;
using Tazq_Frontend.Services;
using Tazq_Frontend.ViewModels;

namespace Tazq_Frontend;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();

        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("Roboto.ttf", "RobotoRegular");
                fonts.AddFont("Roboto-Italic.ttf", "RobotoItalic");
            });

        builder.Services.AddSingleton<ApiService>();
        builder.Services.AddSingleton<AuthViewModel>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }
}