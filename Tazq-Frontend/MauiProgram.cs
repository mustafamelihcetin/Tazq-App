using Microsoft.Extensions.Logging;
using CommunityToolkit.Maui;
using Tazq_Frontend.Services;
using Tazq_Frontend.ViewModels;
using Tazq_Frontend.Views;
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

#if IOS
        Microsoft.Maui.Handlers.EntryHandler.Mapper.AppendToMapping("NoBorder", (handler, view) =>
        {
            if (handler.PlatformView is UITextField textField)
            {
                textField.BorderStyle = UITextBorderStyle.None;
                textField.Layer.BorderWidth = 0;
                textField.Layer.CornerRadius = 0;
                textField.Layer.BackgroundColor = UIColor.Clear.CGColor;
            }
        });
#endif

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

        builder.Services.AddSingleton<ConnectivityService>();
        builder.Services.AddSingleton<LocalCacheService>();
        
        // Register ViewModels
        builder.Services.AddSingleton<AuthViewModel>();
        builder.Services.AddSingleton<HomeViewModel>();
        builder.Services.AddTransient<AddTaskViewModel>();
        builder.Services.AddTransient<EditTaskViewModel>();
        builder.Services.AddTransient<ForgotPasswordViewModel>();
        builder.Services.AddTransient<ResetPasswordViewModel>();
        builder.Services.AddTransient<NotificationSettingsViewModel>();

        // Core
        builder.Services.AddSingleton<AppShell>();

        // Register Pages
        builder.Services.AddTransient<SplashPage>();
        builder.Services.AddSingleton<HomePage>();
        builder.Services.AddTransient<LoginPage>();
        builder.Services.AddTransient<RegisterPage>();
        builder.Services.AddTransient<AddTaskPage>();
        builder.Services.AddTransient<EditTaskPage>();
        builder.Services.AddTransient<ForgotPasswordPage>();
        builder.Services.AddTransient<ResetPasswordPage>();
        builder.Services.AddTransient<NotificationSettingsPage>();
        builder.Services.AddTransient<AboutPage>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        var app = builder.Build();
        Services = app.Services;
        return app;
    }
}
