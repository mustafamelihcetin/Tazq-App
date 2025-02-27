using Microsoft.Maui;
using Microsoft.Maui.Controls;
using Microsoft.Maui.Controls.PlatformConfiguration.WindowsSpecific;
using Microsoft.Maui.Platform;
#if WINDOWS
using Microsoft.UI.Windowing;
using Windows.Graphics;
#endif

namespace Tazq_Frontend;

public partial class App : Microsoft.Maui.Controls.Application
{
	public App()
	{
		InitializeComponent();
		MainPage = new Views.LoginPage();
	}

	protected override Window CreateWindow(IActivationState activationState)
	{
		var window = base.CreateWindow(activationState);

#if WINDOWS
        // Windows için minimum pencere boyutunu belirle
        window.MinimumWidth = 1024;
        window.MinimumHeight = 768;
#endif

		return window;
	}
}
