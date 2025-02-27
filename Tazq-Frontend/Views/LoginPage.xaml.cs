using Microsoft.Maui.Platform;
using Tazq_Frontend.ViewModels;
using Microsoft.Maui.Controls;
using System.Runtime.InteropServices;
#if WINDOWS
using Microsoft.UI.Windowing;
using Microsoft.UI;
using Windows.Graphics;
#endif

namespace Tazq_Frontend.Views
{
	public partial class LoginPage : ContentPage
	{
		private readonly AuthViewModel _viewModel;

		public LoginPage()
		{
			InitializeComponent();
			_viewModel = new AuthViewModel();
			BindingContext = _viewModel;

#if WINDOWS
            SetWindowSize(); // Yaln�zca Windows platformunda �al���r
#endif
		}

#if WINDOWS
        // Windows API: Pencere konumu ve boyutunu y�netmek i�in kullan�lacak
        [DllImport("user32.dll")]
        private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_NOZORDER = 0x0004;
        private const uint SWP_SHOWWINDOW = 0x0040;

        private void SetWindowSize()
        {
            var window = this.GetParentWindow();
            if (window?.Handler?.PlatformView is Microsoft.UI.Xaml.Window nativeWindow)
            {
                IntPtr hWnd = WinRT.Interop.WindowNative.GetWindowHandle(nativeWindow);
                var windowId = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(hWnd);
                var appWindow = AppWindow.GetFromWindowId(windowId);

                if (appWindow != null)
                {
                    // Ba�lang�� boyutunu belirle
                    appWindow.Resize(new SizeInt32(1024, 768));

                    // Minimum boyutun alt�na k���ltmeyi �nlemek i�in Windows API kullan
                    SetWindowPos(hWnd, IntPtr.Zero, 0, 0, 1024, 768, SWP_NOSIZE | SWP_NOZORDER | SWP_SHOWWINDOW);
                }
            }
        }
#endif

		// Google Sign-In Click Event
		private async void OnGoogleLoginClicked(object sender, EventArgs e)
		{
			await DisplayAlert("Google Giri�", "Google ile giri� i�lemi hen�z entegre edilmedi.", "Tamam");
		}

		// Apple Sign-In Click Event
		private async void OnAppleLoginClicked(object sender, EventArgs e)
		{
			await DisplayAlert("Apple Giri�", "Apple ile giri� i�lemi hen�z entegre edilmedi.", "Tamam");
		}
	}
}
