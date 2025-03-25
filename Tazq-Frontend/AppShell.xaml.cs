using Tazq_Frontend.Views;
using Microsoft.Maui.Controls;

namespace Tazq_Frontend
{
	public partial class AppShell : Shell
	{
		public AppShell()
		{
			InitializeComponent();

			// Register correct routes
			Routing.RegisterRoute(nameof(LoginPage), typeof(LoginPage));
			Routing.RegisterRoute(nameof(RegisterPage), typeof(RegisterPage));
			Routing.RegisterRoute(nameof(HomePage), typeof(HomePage));
		}
	}
}
