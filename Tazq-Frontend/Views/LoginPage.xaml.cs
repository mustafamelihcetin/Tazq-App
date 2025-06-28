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

        public LoginPage()
        {
            InitializeComponent();
            _viewModel = new AuthViewModel();
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
            await DisplayAlert("Google Giriþ", "Google ile giriþ iþlemi henüz entegre edilmedi.", "Tamam");
        }

        private async Task OnAppleLoginClickedAsync()
        {
            await DisplayAlert("Apple Giriþ", "Apple ile giriþ iþlemi henüz entegre edilmedi.", "Tamam");
        }
    }
}