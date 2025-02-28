using Microsoft.Maui.Controls;
using Tazq_Frontend.ViewModels;

namespace Tazq_Frontend.Views
{
	public partial class RegisterPage : ContentPage
	{
		public RegisterPage()
		{
			InitializeComponent();
			BindingContext = new AuthViewModel(); // Set ViewModel properly
		}
	}
}
