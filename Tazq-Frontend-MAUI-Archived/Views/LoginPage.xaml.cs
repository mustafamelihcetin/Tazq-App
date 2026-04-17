using Tazq_Frontend.ViewModels;
using Microsoft.Maui.Controls;
using System;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Extensions.DependencyInjection;

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
            _viewModel = MauiProgram.Services?.GetService<AuthViewModel>() ?? throw new InvalidOperationException("AuthViewModel not found");
            BindingContext = _viewModel;

            GoogleLoginCommand = new AsyncRelayCommand(OnGoogleLoginClickedAsync);
            AppleLoginCommand = new AsyncRelayCommand(OnAppleLoginClickedAsync);
        }

        protected override void OnAppearing()
        {
            base.OnAppearing();
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
