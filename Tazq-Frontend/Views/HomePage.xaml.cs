using System;
using Tazq_Frontend.ViewModels;

namespace Tazq_Frontend.Views
{
    public partial class HomePage : ContentPage
    {
        public HomePage()
        {
            InitializeComponent();
            Console.WriteLine("[DOTNET] HomePage yüklendi.");
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

        protected override async void OnAppearing()
        {
            base.OnAppearing();

            HeaderGrid.Opacity = 0;
            AddTaskFrame.Opacity = 0;
            MainRefreshView.Opacity = 0;

            await Task.Delay(200);

            await HeaderGrid.FadeTo(1, 300);
            await AddTaskFrame.FadeTo(1, 300);
            await MainRefreshView.FadeTo(1, 300);
        }
    }
}