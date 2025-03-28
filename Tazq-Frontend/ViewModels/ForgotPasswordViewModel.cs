using System.Net.Http.Json;
using System.Threading.Tasks;
using System.Windows.Input;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Tazq_Frontend.Services;

namespace Tazq_Frontend.ViewModels
{
	public partial class ForgotPasswordViewModel : ObservableObject
	{
		[ObservableProperty]
		private string email;

		[ObservableProperty]
		private string statusMessage;

		public ICommand SendResetLinkCommand => new AsyncRelayCommand(SendResetLink);

		private async Task SendResetLink()
		{
			if (string.IsNullOrWhiteSpace(Email))
			{
				StatusMessage = "Lütfen geçerli bir e-posta adresi girin.";
				return;
			}

			var apiService = new ApiService();
			var payload = new { Email = this.Email };

			try
			{
				var response = await apiService.PostAsync("users/forgot-password", payload);

				if (response.IsSuccessStatusCode)
				{
					StatusMessage = "E-posta gönderildi. Gelen kutunuzu kontrol edin.";
				}
				else
				{
					var error = await response.Content.ReadAsStringAsync();
					StatusMessage = !string.IsNullOrWhiteSpace(error)
						? $"Hata: {error}" // This will show backend error content if any
						: "Hata: Şifre sıfırlama bağlantısı gönderilemedi. Lütfen tekrar deneyin.";


				}
			}
			catch (Exception ex)
			{
				StatusMessage = $"İstek başarısız: {ex.Message}";
			}
		}
	}
}
