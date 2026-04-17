using Tazq_Frontend.ViewModels;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Views
{
	public partial class ForgotPasswordPage : ContentPage
	{
		public ForgotPasswordPage()
		{
			InitializeComponent();
            BindingContext = MauiProgram.Services?.GetService<ForgotPasswordViewModel>() ?? throw new InvalidOperationException("ForgotPasswordViewModel not found");
		}
	}
}
