using Microsoft.Maui.Controls;
using Tazq_Frontend.Views;
using Tazq_Frontend.Services;
using Tazq_Frontend.Helpers;

namespace Tazq_Frontend.Views
{
    public partial class SplashPage : ContentPage
    {
        private readonly ApiService _apiService = MauiProgram.Services!.GetRequiredService<ApiService>();

        public SplashPage()
        {
            InitializeComponent();
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

            bool isValid = false;
            try
            {
                var token = await SecureStorage.GetAsync("jwt_token");

                if (!string.IsNullOrEmpty(token))
                {
                    isValid = await _apiService.CheckTokenValidityAsync();
                    if (!isValid)
                    {
                        var newToken = await _apiService.RefreshTokenAsync();
                        if (!string.IsNullOrEmpty(newToken))
                        {
                            await _apiService.SaveToken(newToken);
                            isValid = true;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Splash] Token kontrol hatasý: {ex.Message}");
            }

            await LoadingIndicator.FadeTo(0, 400);
            LoadingIndicator.IsVisible = false;

            await Shell.Current.GoToAsync(isValid ? $"///{RouteNames.HomePage}" : $"///{RouteNames.LoginPage}");
        }
    }
}