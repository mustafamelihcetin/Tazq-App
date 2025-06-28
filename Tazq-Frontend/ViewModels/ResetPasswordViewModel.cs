using System;
using System.Net.Http;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Maui.Controls;
using Tazq_Frontend.Services;
using Tazq_Frontend.Helpers;
using Tazq_Frontend;

namespace Tazq_Frontend.ViewModels
{
    public partial class ResetPasswordViewModel : ObservableObject
    {
        private string _newPassword = string.Empty;
        public string NewPassword
        {
            get => _newPassword;
            set => SetProperty(ref _newPassword, value);
        }

        private string _confirmPassword = string.Empty;
        public string ConfirmPassword
        {
            get => _confirmPassword;
            set => SetProperty(ref _confirmPassword, value);
        }

        private string _token = string.Empty;
        public string Token
        {
            get => _token;
            set => SetProperty(ref _token, value);
        }

        private string _statusMessage = string.Empty;
        public string StatusMessage
        {
            get => _statusMessage;
            set => SetProperty(ref _statusMessage, value);
        }

        private bool _isLoading;
        public bool IsLoading
        {
            get => _isLoading;
            set => SetProperty(ref _isLoading, value);
        }

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

                var apiService = MauiProgram.Services!.GetRequiredService<ApiService>();
                var response = await apiService.PostAsync("users/reset-password", resetRequest);

                if (response.IsSuccessStatusCode)
                {
                    StatusMessage = "Şifre başarıyla sıfırlandı.";
                    await Task.Delay(1500);
                    await Shell.Current.GoToAsync($"//{RouteNames.LoginPage}");
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