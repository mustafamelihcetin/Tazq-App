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
			if (Shell.Current != null)
			{
				await Shell.Current.GoToAsync(nameof(Views.RegisterPage));
			}
			else if (Application.Current?.MainPage != null)
			{
				await Application.Current.MainPage.DisplayAlert("Hata", "Navigasyon hatası oluştu!", "Tamam");
			}
		});

		// Command for navigating back to Login Page
		public ICommand NavigateToLoginCommand => new AsyncRelayCommand(async () =>
		{
			if (Shell.Current != null)
			{
				await Shell.Current.GoToAsync("//LoginPage");
			}
			else if (Application.Current?.MainPage != null)
			{
				await Application.Current.MainPage.DisplayAlert("Hata", "Navigasyon hatası oluştu!", "Tamam");
			}
		});

		// Command for Login Action
		public ICommand LoginCommand => new AsyncRelayCommand(async () =>
		{
			try
			{
				if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
				{
					var page = Application.Current?.MainPage;
					if (page != null)
					{
						await page.DisplayAlert("Hata", "E-posta ve şifre boş olamaz!", "Tamam");
					}
					return;
				}

				Console.WriteLine("Giriş denemesi yapılıyor...");

				bool loginSuccess = await _apiService.Login(Email, Password);

				var currentPage = Application.Current?.MainPage;

				if (loginSuccess)
				{
					if (currentPage != null)
						await currentPage.DisplayAlert("Başarılı", "Giriş başarılı!", "Tamam");
				}
				else
				{
					if (currentPage != null)
						await currentPage.DisplayAlert("Hata", "Geçersiz giriş bilgileri! Lütfen tekrar deneyin.", "Tamam");
				}
			}
			catch (Exception ex)
			{
				var currentPage = Application.Current?.MainPage;
				if (currentPage != null)
					await currentPage.DisplayAlert("Hata", $"Login hatası: {ex.Message}", "Tamam");
			}
		});

		// Command for Register Action
		public ICommand RegisterCommand => new AsyncRelayCommand(async () =>
		{
			try
			{
				if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
				{
					var page = Application.Current?.MainPage;
					if (page != null)
					{
						await page.DisplayAlert("Hata", "E-posta ve şifre boş olamaz!", "Tamam");
					}
					return;
				}

				Console.WriteLine("Kayıt denemesi yapılıyor...");

				string name = "Kullanıcı";
				var (success, errorMessage) = await _apiService.RegisterWithMessage(Email, name, Password);

				var currentPage = Application.Current?.MainPage;

				if (success)
				{
					if (currentPage != null)
						await currentPage.DisplayAlert("Başarılı", "Kayıt işlemi tamamlandı!", "Tamam");

					if (Shell.Current != null)
						await Shell.Current.GoToAsync("//LoginPage");
				}
				else
				{
					if (currentPage != null)
						await currentPage.DisplayAlert("Hata", errorMessage ?? "Kayıt başarısız oldu!", "Tamam");
				}
			}
			catch (Exception ex)
			{
				var page = Application.Current?.MainPage;
				if (page != null)
					await page.DisplayAlert("Hata", $"Kayıt hatası: {ex.Message}", "Tamam");
			}
		});
	}
}
