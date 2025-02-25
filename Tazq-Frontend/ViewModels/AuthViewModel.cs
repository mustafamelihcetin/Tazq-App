using System.Windows.Input;
using Tazq_Frontend.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace Tazq_Frontend.ViewModels
{
	public partial class AuthViewModel : ObservableObject
	{
		private readonly ApiService _apiService;

		public AuthViewModel()
		{
			_apiService = new ApiService();
		}

		[ObservableProperty]
		private string email = string.Empty;

		[ObservableProperty]
		private string password = string.Empty;

		[ObservableProperty]
		private bool canLogin;

		partial void OnEmailChanged(string value) => UpdateCanLogin();
		partial void OnPasswordChanged(string value) => UpdateCanLogin();

		private void UpdateCanLogin()
		{
			CanLogin = !string.IsNullOrWhiteSpace(Email) && !string.IsNullOrWhiteSpace(Password);
		}

		public ICommand LoginCommand => new AsyncRelayCommand(Login);

		private async Task Login()
		{
			if (!CanLogin) return;

			bool success = await _apiService.Login(Email, Password);
			if (success)
			{
				await Application.Current.MainPage.DisplayAlert("Başarılı", "Giriş başarılı!", "Tamam");
			}
			else
			{
				await Application.Current.MainPage.DisplayAlert("Hata", "Geçersiz giriş bilgileri", "Tamam");
			}
		}
	}
}
