using Microsoft.Maui.Platform;
using Tazq_Frontend.ViewModels;
using Microsoft.Maui.Controls;
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

			SetWindowSize(); // Windows i�in minimum pencere boyutunu ayarla
		}

		// Windows i�in minimum pencere boyutunu belirleme
		private void SetWindowSize()
		{
#if WINDOWS
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

                    // Minimum pencere boyutunu belirle (K���ltmeyi engelle)
                    var presenter = appWindow.Presenter as OverlappedPresenter;
                    if (presenter != null)
                    {
                        presenter.SetBorderAndTitleBar(true, true);
                        presenter.IsResizable = true; // Kullan�c� yine boyutland�rabilir ama min s�n�r� olur
                        presenter.Maximize(); // Pencereyi ba�larken maksimum boyutta a�
                    }

                    // Minimum boyutu do�rudan ayarla
                    appWindow.Resize(new SizeInt32(Math.Max(appWindow.Size.Width, 800), Math.Max(appWindow.Size.Height, 600)));
                }
            }
#endif
		}

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
