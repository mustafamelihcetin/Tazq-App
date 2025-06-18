using Tazq_Frontend.Views;

#if WINDOWS
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Windows.Graphics;
using WinRT.Interop;
#endif

namespace Tazq_Frontend;

public partial class App : Application
{
    public App()
    {
        InitializeComponent();

        // Read user preference and apply theme accordingly
        bool isLightEnabled = Preferences.Default.Get("IsLightThemeEnabled", false);
        Application.Current.UserAppTheme = isLightEnabled ? AppTheme.Light : AppTheme.Dark;

        MainPage = new AppShell();
    }

    protected override Window CreateWindow(IActivationState activationState)
    {
        var window = base.CreateWindow(activationState);

#if WINDOWS
        window.HandlerChanged += (s, e) =>
        {
            var nativeWindow = (MauiWinUIWindow)window.Handler.PlatformView;
            IntPtr hWnd = WindowNative.GetWindowHandle(nativeWindow);
            WindowId wndId = Win32Interop.GetWindowIdFromWindow(hWnd);
            AppWindow appWindow = AppWindow.GetFromWindowId(wndId);

            nativeWindow.Title = "TAZQ";
            appWindow.Resize(new SizeInt32(1280, 800));
        };
#endif

        return window;
    }
}