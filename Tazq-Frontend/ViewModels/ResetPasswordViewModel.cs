using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using System.Windows.Input;
using Microsoft.Maui.Controls;
using CommunityToolkit.Mvvm.ComponentModel;
using Tazq_Frontend.Services;

namespace Tazq_Frontend.ViewModels
{
	public partial class ResetPasswordViewModel : ObservableObject
	{
		private string _newPassword;
		private string _confirmPassword;
		private string _token;
		private string _statusMessage;

		public string NewPassword
		{
			get => _newPassword;
			set => SetProperty(ref _newPassword, value);
		}

		public string ConfirmPassword
		{
			get => _confirmPassword;
			set => SetProperty(ref _confirmPassword, value);
		}

		public string Token
		{
			get => _token;
			set => SetProperty(ref _token, value);
		}

		public string StatusMessage
		{
			get => _statusMessage;
			set => SetProperty(ref _statusMessage, value);
		}

		public ICommand ResetPasswordCommand { get; }

		public ResetPasswordViewModel()
		{
			ResetPasswordCommand = new Command(async () => await ResetPasswordAsync());
		}

		private async Task ResetPasswordAsync()
		{
			if (string.IsNullOrWhiteSpace(NewPassword) || string.IsNullOrWhiteSpace(ConfirmPassword) || string.IsNullOrWhiteSpace(Token))
			{
				StatusMessage = "Tüm alanları doldurmalısınız.";
				return;
			}

			if (NewPassword != ConfirmPassword)
			{
				StatusMessage = "Şifreler uyuşmuyor.";
				return;
			}

			try
			{
				var resetRequest = new
				{
					Token = Token,
					NewPassword = NewPassword
				};

				var apiService = new ApiService();
				var response = await apiService.PostAsync("users/reset-password", resetRequest);

				if (response.IsSuccessStatusCode)
				{
					StatusMessage = "Şifre başarıyla sıfırlandı.";
					await Task.Delay(1500); 
					await Shell.Current.GoToAsync("//LoginPage");
				}
				else
				{
					var content = await response.Content.ReadAsStringAsync();
					StatusMessage = $"Hata: {content}";
				}
			}
			catch (Exception ex)
			{
				StatusMessage = $"İstek sırasında hata oluştu: {ex.Message}";
			}
		}
	}
}