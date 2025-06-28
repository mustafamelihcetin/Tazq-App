using Microsoft.Extensions.Logging;
using CommunityToolkit.Maui;
using Tazq_Frontend.Services;
using Tazq_Frontend.ViewModels;
using SkiaSharp;

#if IOS
using UIKit;
#endif

namespace Tazq_Frontend;

public static class MauiProgram
{
    public static IServiceProvider? Services { get; private set; }
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();

        builder
            .UseMauiApp<App>()
            .UseMauiCommunityToolkit()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("Roboto.ttf", "RobotoRegular");
                fonts.AddFont("Roboto-Italic.ttf", "RobotoItalic");
            });

        builder.Services.AddHttpClient<ApiService>(client =>
        {
            client.BaseAddress = new Uri(ApiConstants.BaseUrl);
            client.DefaultRequestHeaders.Add("X-App-Signature", "tazq-maui-frontend");
        });
        builder.Services.AddSingleton<AuthViewModel>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        var app = builder.Build();
        Services = app.Services;
        return app;
    }
}
