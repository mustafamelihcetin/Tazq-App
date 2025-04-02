using System;
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

        // Triggered when user pulls down to refresh
        private void MainRefreshView_Refreshing(object sender, EventArgs e)
        {
            if (BindingContext is HomeViewModel viewModel)
            {
                viewModel.IsScrolledDown = true;
            }

            MainRefreshView.IsRefreshing = false;
        }
    }
}