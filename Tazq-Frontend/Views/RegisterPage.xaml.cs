using Microsoft.Maui.Controls;
using Tazq_Frontend.ViewModels;
using Tazq_Frontend.Helpers;
using Tazq_Frontend.Services;
using System;

namespace Tazq_Frontend.Views
{
    public partial class RegisterPage : ContentPage
    {
        private readonly AuthViewModel _viewModel;
        private readonly ApiService _apiService;

        public RegisterPage(AuthViewModel viewModel, ApiService apiService)
        {
            InitializeComponent();
            
            _viewModel = viewModel;
            _apiService = apiService;
            BindingContext = _viewModel;
        }

        // This method is triggered when the register button is clicked
        private async void OnRegisterClicked(object sender, EventArgs e)
        {
            Console.WriteLine("Register button clicked.");

            try
            {
                if (string.IsNullOrWhiteSpace(_viewModel.Email) || string.IsNullOrWhiteSpace(_viewModel.Password))
                {
                    await DisplayAlert("Hata", "E-posta ve şifre boş olamaz!", "Tamam");
                    return;
                }

                // You can also collect name from UI if needed (currently hardcoded)
                string name = "Kullanıcı"; // Adjust if name input exists
                bool result = await _apiService.Register(_viewModel.Email, name, _viewModel.Password);

                if (result)
                {
                    Console.WriteLine("Register successful.");
                    await DisplayAlert("Başarılı", "Kayıt işlemi tamamlandı.", "Tamam");
                    await Shell.Current.GoToAsync($"///{RouteNames.LoginPage}");
                }
                else
                {
                    Console.WriteLine("Register failed.");
                    await DisplayAlert("Hata", "Kayıt işlemi başarısız oldu.", "Tamam");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Register exception: {ex.Message}");
                await DisplayAlert("Hata", "Bir hata oluştu, lütfen tekrar deneyin.", "Tamam");
            }
        }
    }
}

