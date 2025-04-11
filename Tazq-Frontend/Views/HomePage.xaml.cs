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

        private async void MainRefreshView_Refreshing(object sender, EventArgs e)
        {
            if (BindingContext is HomeViewModel viewModel)
            {
                await viewModel.LoadTasksAsync();
                viewModel.IsScrolledDown = true;
            }

            if (MainRefreshView != null)
                MainRefreshView.IsRefreshing = false;
        }

        private void MainRefreshView_Scrolled(object sender, ScrolledEventArgs e)
        {
            Console.WriteLine($"[DEBUG] Scroll Y: {e.ScrollY}");

            if (BindingContext is HomeViewModel viewModel)
            {
                viewModel.IsScrolledDown = e.ScrollY > 30;
            }
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