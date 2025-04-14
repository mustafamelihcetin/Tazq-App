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
            SloganLabel.Opacity = 0;
            SloganLabel.TranslationY = 20;
            LoadingIndicator.IsVisible = true;

            await Task.Delay(300);
            await Logo.FadeTo(1, 800, Easing.CubicInOut);

            await Task.Delay(500);

            var sloganFade = SloganLabel.FadeTo(1, 600, Easing.CubicInOut);
            var sloganSlide = SloganLabel.TranslateTo(0, 0, 600, Easing.CubicOut);
            var loaderFadeIn = LoadingIndicator.FadeTo(1, 600, Easing.CubicInOut);

            await Task.WhenAll(sloganFade, sloganSlide, loaderFadeIn);

            await Task.Delay(500);

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

            await LoadingIndicator.FadeTo(0, 400);
            LoadingIndicator.IsVisible = false;

            await Shell.Current.GoToAsync(isValid ? "//HomePage" : "//LoginPage");
        }
    }
}