using Microsoft.Maui.Controls;
using Tazq_Frontend.ViewModels;

namespace Tazq_Frontend.Views
{
	public partial class ResetPasswordPage : ContentPage
	{
		public ResetPasswordPage()
		{
			InitializeComponent();
			BindingContext = new ResetPasswordViewModel();
		}
	}
}