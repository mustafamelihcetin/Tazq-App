using Tazq_Frontend.ViewModels;
using Microsoft.Maui.Controls;
using System;
using CommunityToolkit.Mvvm.Input;

namespace Tazq_Frontend.Views
{
    public partial class LoginPage : ContentPage
    {
        private readonly AuthViewModel _viewModel;
        public IAsyncRelayCommand GoogleLoginCommand { get; }
        public IAsyncRelayCommand AppleLoginCommand { get; }

        public LoginPage(AuthViewModel viewModel)
        {
            InitializeComponent();
            _viewModel = viewModel;
            BindingContext = _viewModel;

            GoogleLoginCommand = new AsyncRelayCommand(OnGoogleLoginClickedAsync);
            AppleLoginCommand = new AsyncRelayCommand(OnAppleLoginClickedAsync);
        }

        protected override async void OnAppearing()
        {
            base.OnAppearing();

            // Animate logo section sliding from right to center
            await LogoStack.TranslateTo(0, 0, 600, Easing.CubicOut);
        }

        private void OnPasswordCompleted(object sender, EventArgs e)
        {
            if (!_viewModel.IsLoading && _viewModel.LoginCommand.CanExecute(null))
            {
                _viewModel.LoginCommand.Execute(null);
            }
        }

        private async Task OnGoogleLoginClickedAsync()
        {
            await DisplayAlert("Google Giriş", "Google ile giriş işlemi henüz entegre edilmedi.", "Tamam");
        }

        private async Task OnAppleLoginClickedAsync()
        {
            await DisplayAlert("Apple Giriş", "Apple ile giriş işlemi henüz entegre edilmedi.", "Tamam");
        }
    }
}
