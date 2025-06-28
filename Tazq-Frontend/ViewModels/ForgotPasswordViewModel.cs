using System.Net.Http.Json;
using System.Threading.Tasks;
using System.Windows.Input;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Maui.Controls;
using Tazq_Frontend.Services;
using Tazq_Frontend.Helpers;
using Tazq_Frontend;

namespace Tazq_Frontend.ViewModels
{
    public partial class ForgotPasswordViewModel : ObservableObject
    {
        private string _email = string.Empty;
        public string Email
        {
            get => _email;
            set => SetProperty(ref _email, value);
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

        public ICommand SendResetLinkCommand => new AsyncRelayCommand(SendResetLink);

        private async Task SendResetLink()
        {
            IsLoading = true;
            StatusMessage = string.Empty;

            if (string.IsNullOrWhiteSpace(Email))
            {
                StatusMessage = "Lütfen geçerli bir e-posta adresi girin.";
                IsLoading = false;
                return;
            }

            var apiService = MauiProgram.Services!.GetRequiredService<ApiService>();
            var payload = new { Email = this.Email };

            try
            {
                var response = await apiService.PostAsync("users/forgot-password", payload);

                if (response.IsSuccessStatusCode)
                {
                    StatusMessage = "E-posta gönderildi. Gelen kutunuzu kontrol edin.";
                    await Task.Delay(1500);
                    await Shell.Current.GoToAsync(RouteNames.ResetPasswordPage);
                }
                else
                {
                    var error = await response.Content.ReadAsStringAsync();
                    StatusMessage = !string.IsNullOrWhiteSpace(error)
                        ? $"Hata: {error}"
                        : "Hata: Şifre sıfırlama bağlantısı gönderilemedi. Lütfen tekrar deneyin.";
                }
            }
            catch (Exception ex)
            {
                StatusMessage = $"İstek başarısız: {ex.Message}";
            }
            finally
            {
                IsLoading = false;
            }
        }
    }
}