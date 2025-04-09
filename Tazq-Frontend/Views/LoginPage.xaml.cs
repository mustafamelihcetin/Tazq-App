using Tazq_Frontend.ViewModels;
using Microsoft.Maui.Controls;
using System;

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
        }

        private void OnPasswordCompleted(object sender, EventArgs e)
        {
            if (_viewModel.LoginCommand.CanExecute(null))
            {
                _viewModel.LoginCommand.Execute(null);
            }
        }

        private async void OnGoogleLoginClicked(object sender, EventArgs e)
        {
            await DisplayAlert("Google Giri�", "Google ile giri� i�lemi hen�z entegre edilmedi.", "Tamam");
        }

        private async void OnAppleLoginClicked(object sender, EventArgs e)
        {
            await DisplayAlert("Apple Giri�", "Apple ile giri� i�lemi hen�z entegre edilmedi.", "Tamam");
        }
    }
}