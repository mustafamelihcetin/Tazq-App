using Microsoft.Maui.Controls;
using Tazq_Frontend.ViewModels;

namespace Tazq_Frontend.Views
{
	public partial class RegisterPage : ContentPage
	{
		private readonly AuthViewModel _viewModel;

		public RegisterPage()
		{
			InitializeComponent();
			_viewModel = new AuthViewModel();
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
					await DisplayAlert("Hata", "E-posta ve þifre boþ olamaz!", "Tamam");
					return;
				}

				// You can also collect name from UI if needed (currently hardcoded)
				string name = "Kullanýcý"; // Adjust if name input exists
				bool result = await new Services.ApiService().Register(_viewModel.Email, name, _viewModel.Password);

				if (result)
				{
					Console.WriteLine("Register successful.");
					await DisplayAlert("Baþarýlý", "Kayýt iþlemi tamamlandý.", "Tamam");
                    await Shell.Current.GoToAsync($"//{nameof(LoginPage)}");
                }
				else
				{
					Console.WriteLine("Register failed.");
					await DisplayAlert("Hata", "Kayýt iþlemi baþarýsýz oldu.", "Tamam");
				}
			}
			catch (Exception ex)
			{
				Console.WriteLine($"Register exception: {ex.Message}");
				await DisplayAlert("Hata", "Bir hata oluþtu: " + ex.Message, "Tamam");
			}
		}
	}
}
