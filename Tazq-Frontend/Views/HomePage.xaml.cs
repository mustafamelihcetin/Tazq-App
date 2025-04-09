using System;
using Tazq_Frontend.ViewModels;

namespace Tazq_Frontend.Views
{
    public partial class HomePage : ContentPage
    {
        public HomePage()
        {
            InitializeComponent();
            Console.WriteLine("[DOTNET] HomePage y�klendi.");
            BindingContext = new HomeViewModel();
        }

        // Triggered when user pulls down to refresh
        private void MainRefreshView_Refreshing(object sender, EventArgs e)
        {
            if (BindingContext is HomeViewModel viewModel)
            {
                viewModel.IsScrolledDown = true;
            }

            if (MainRefreshView != null)
                MainRefreshView.IsRefreshing = false;
        }
    }
}