using Tazq_Frontend.Views;

#if WINDOWS
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Windows.Graphics;
using WinRT.Interop;
using Windows.Foundation;
using Windows.UI.ViewManagement;
#endif

namespace Tazq_Frontend;

public partial class App : Application
{
    public App()
    {
        InitializeComponent();

        // Read user preference and apply theme accordingly
        bool isLightEnabled = Preferences.Default.Get("IsLightThemeEnabled", false);
        if (Application.Current != null)
        {
            Application.Current.UserAppTheme = isLightEnabled ? AppTheme.Light : AppTheme.Dark;
        }

        MainPage = new AppShell();
    }

    protected override Window CreateWindow(IActivationState activationState)
    {
        var window = base.CreateWindow(activationState);

#if WINDOWS
        window.HandlerChanged += (s, e) =>
        {
             if (window.Handler?.PlatformView is MauiWinUIWindow nativeWindow)
            {
                nativeWindow.Title = "TAZQ";

                IntPtr hWnd = WindowNative.GetWindowHandle(nativeWindow);
                WindowId wndId = Win32Interop.GetWindowIdFromWindow(hWnd);
                AppWindow appWindow = AppWindow.GetFromWindowId(wndId);

                appWindow.Resize(new SizeInt32(1280, 800));
            }
        };
#endif

        return window;
    }
}