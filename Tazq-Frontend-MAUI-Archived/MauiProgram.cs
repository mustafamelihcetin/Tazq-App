using Microsoft.Extensions.Logging;
using CommunityToolkit.Maui;
using Tazq_Frontend.Services;
using Tazq_Frontend.ViewModels;
using Tazq_Frontend.Views;

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
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
                fonts.AddFont("Roboto.ttf", "RobotoRegular");
                fonts.AddFont("Roboto-Italic.ttf", "RobotoItalic");
            });

        // Services
        builder.Services.AddSingleton<ConnectivityService>();
        builder.Services.AddSingleton<LocalCacheService>();
        builder.Services.AddSingleton<IHapticService, HapticService>();
        
        builder.Services.AddHttpClient<ApiService>(client =>
        {
            client.BaseAddress = new Uri(ApiConstants.BaseUrl);
            client.DefaultRequestHeaders.Add("X-App-Signature", "tazq-maui-frontend");
        });

        // ViewModels
        builder.Services.AddTransient<AuthViewModel>();
        builder.Services.AddTransient<HomeViewModel>();
        builder.Services.AddTransient<AddTaskViewModel>();
        builder.Services.AddTransient<EditTaskViewModel>();
        builder.Services.AddTransient<ForgotPasswordViewModel>();
        builder.Services.AddTransient<ResetPasswordViewModel>();
        builder.Services.AddTransient<NotificationSettingsViewModel>();
        builder.Services.AddTransient<AboutViewModel>();

        // Pages
        builder.Services.AddTransient<SplashPage>();
        builder.Services.AddTransient<LoginPage>();
        builder.Services.AddTransient<RegisterPage>();
        builder.Services.AddTransient<HomePage>();
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
