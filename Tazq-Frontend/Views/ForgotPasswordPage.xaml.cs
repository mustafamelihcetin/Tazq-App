using Tazq_Frontend.ViewModels;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Views
{
	public partial class ForgotPasswordPage : ContentPage
	{
		public ForgotPasswordPage(ForgotPasswordViewModel viewModel)
		{
			InitializeComponent();
            BindingContext = viewModel;
		}
	}
}
