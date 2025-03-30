using Tazq_Frontend.ViewModels;

namespace Tazq_Frontend.Views
{
	public partial class HomePage : ContentPage
	{
		public HomePage()
		{
			InitializeComponent();
            BindingContext = new HomeViewModel();
        }
	}
}