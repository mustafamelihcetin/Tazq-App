using System.Windows.Input;
using Tazq_Frontend.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.ViewModels
{
	public partial class AuthViewModel : ObservableObject
	{
		private readonly ApiService _apiService;

		public AuthViewModel()
		{
			_apiService = new ApiService();
		}

		// Email Property
		private string _email = string.Empty;
		public string Email
		{
			get => _email;
			set => SetProperty(ref _email, value);
		}

		// Password Property
		private string _password = string.Empty;
		public string Password
		{
			get => _password;
			set => SetProperty(ref _password, value);
		}

		// Command for navigating to Register Page
		public ICommand NavigateToRegisterCommand => new AsyncRelayCommand(async () =>
		{
			if (Shell.Current == null)
			{
				await Application.Current?.MainPage?.DisplayAlert("Hata", "Navigasyon hatası oluştu!", "Tamam");
				return;
			}

			await Shell.Current.GoToAsync(nameof(Views.RegisterPage));
		});

		// Command for navigating back to Login Page
		public ICommand NavigateToLoginCommand => new AsyncRelayCommand(async () =>
		{
			if (Shell.Current == null)
			{
				await Application.Current?.MainPage?.DisplayAlert("Hata", "Navigasyon hatası oluştu!", "Tamam");
				return;
			}

			await Shell.Current.GoToAsync("//Login");
		});

		// Command for Login Action
		public ICommand LoginCommand => new AsyncRelayCommand(async () =>
		{
			try
			{
				if (Application.Current?.MainPage == null)
				{
					Application.Current.MainPage = new NavigationPage(new Views.LoginPage());
				}
				if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
				{
					await Application.Current?.MainPage?.DisplayAlert("Hata", "E-posta ve şifre alanları boş olamaz!", "Tamam");
					return;
				}

				// Debugging: Show Alert to Check If This Code is Running
				await Application.Current?.MainPage?.DisplayAlert("Debug", "LoginCommand çalıştı!", "Tamam");

				// Simulate login process
				bool loginSuccess = await _apiService.Login(Email, Password);

				if (loginSuccess)
				{
					await Application.Current?.MainPage?.DisplayAlert("Başarılı", "Giriş başarılı!", "Tamam");
				}
				else
				{
					await Application.Current?.MainPage?.DisplayAlert("Hata", "Geçersiz giriş bilgileri!", "Tamam");
				}
			}
			catch (Exception ex)
			{
				await Application.Current?.MainPage?.DisplayAlert("Hata", $"Android'de LoginCommand hatası: {ex.Message}", "Tamam");
			}
		});


		// Command for Register Action
		public ICommand RegisterCommand => new AsyncRelayCommand(async () =>
		{
			// Simulate registration process (replace this with API call if needed)
			await Application.Current?.MainPage?.DisplayAlert("Başarılı", "Kayıt işlemi tamamlandı!", "Tamam");

			if (Shell.Current != null)
			{
				await Shell.Current.GoToAsync("//LoginPage");
			}
			else
			{
				await Application.Current?.MainPage?.DisplayAlert("Hata", "Navigasyon hatası oluştu!", "Tamam");
			}
		});

	}
}
