using Microsoft.Maui.Controls;
using Tazq_Frontend.Views;
using Tazq_Frontend.Services;

namespace Tazq_Frontend.Views
{
    public partial class SplashPage : ContentPage
    {
        private readonly ApiService _apiService = new();

        public SplashPage()
        {
            InitializeComponent();
            BackgroundColor = Color.FromArgb("#212121");
        }
        protected override async void OnAppearing()
        {
            base.OnAppearing();

            Logo.Opacity = 0;
            await Task.Delay(300);
            await Logo.FadeTo(1, 800, Easing.CubicInOut);
            await Task.Delay(500);
            await Logo.FadeTo(0, 600, Easing.CubicInOut);

            var token = await SecureStorage.GetAsync("jwt_token");

            bool isValid = false;
            if (!string.IsNullOrEmpty(token))
            {
                isValid = await _apiService.CheckTokenValidityAsync();
                if (!isValid)
                {
                    var newToken = await _apiService.RefreshTokenAsync();
                    isValid = !string.IsNullOrEmpty(newToken);
                }
            }

            await Shell.Current.GoToAsync(isValid ? "//HomePage" : "//LoginPage");
        }

    }
}