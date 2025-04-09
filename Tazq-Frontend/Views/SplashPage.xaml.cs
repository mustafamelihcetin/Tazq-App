using Microsoft.Maui.Controls;
using Tazq_Frontend.Views;

namespace Tazq_Frontend.Views
{
    public partial class SplashPage : ContentPage
    {
        public SplashPage()
        {
            InitializeComponent();
        }

        protected override async void OnAppearing()
        {
            base.OnAppearing();
            await AnimateLogoAsync();
        }

        private async Task AnimateLogoAsync()
        {
            await Logo.FadeTo(1, 800, Easing.CubicInOut);
            await Logo.TranslateTo(0, -180, 1000, Easing.SpringOut);
            await Task.Delay(400);

            Application.Current.MainPage = new AppShell();

            var token = await SecureStorage.GetAsync("jwt_token");

            if (!string.IsNullOrEmpty(token))
            {
                await Shell.Current.GoToAsync("//HomePage");
            }
            else
            {
                await Shell.Current.GoToAsync("//LoginPage");
            }
        }
    }
}
