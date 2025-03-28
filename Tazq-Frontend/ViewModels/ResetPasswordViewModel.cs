using System;
using System.Net.Http;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Maui.Controls;
using System.Windows.Input;
using Tazq_Frontend.Services;

namespace Tazq_Frontend.ViewModels
{
	public partial class ResetPasswordViewModel : ObservableObject
	{
		[ObservableProperty]
		private string newPassword;

		[ObservableProperty]
		private string confirmPassword;

		[ObservableProperty]
		private string token;

		[ObservableProperty]
		private string statusMessage;

		[ObservableProperty]
		private bool isLoading;

		[RelayCommand]
		private async Task ResetPasswordAsync()
		{
			IsLoading = true;
			StatusMessage = string.Empty;

			if (string.IsNullOrWhiteSpace(NewPassword) ||
				string.IsNullOrWhiteSpace(ConfirmPassword) ||
				string.IsNullOrWhiteSpace(Token))
			{
				StatusMessage = "Tüm alanları doldurmalısınız.";
				IsLoading = false;
				return;
			}

			if (NewPassword != ConfirmPassword)
			{
				StatusMessage = "Şifreler uyuşmuyor.";
				IsLoading = false;
				return;
			}

			try
			{
				var resetRequest = new
				{
					token = Token.Trim(),
					newPassword = NewPassword
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
			finally
			{
				IsLoading = false;
			}
		}
	}
}