using System;
using Tazq_Frontend.ViewModels;
using Tazq_Frontend.Models;
using Microsoft.Maui.Controls;
using Microsoft.Maui.Devices;

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
            if (BindingContext is HomeViewModel viewModel)
            {
                viewModel.IsScrolledDown = e.ScrollY > 30;
            }
        }

        private async void CheckBox_CheckedChanged(object sender, CheckedChangedEventArgs e)
        {
            if (BindingContext is HomeViewModel viewModel && sender is CheckBox checkBox && checkBox.BindingContext is TaskModel task)
            {
                await viewModel.ToggleTaskCompletionCommand.ExecuteAsync(task);
            }
        }
        private void OnStatusFilterChanged(object sender, CheckedChangedEventArgs e)
        {
            if (BindingContext is HomeViewModel vm && e.Value)
            {
                vm.FilterByCompleted = null;

                if (vm.IsStatusCompleted)
                    vm.FilterByCompleted = true;
                else if (vm.IsStatusIncomplete)
                    vm.FilterByCompleted = false;

                vm.ApplyFilters();
            }
        }




        private void OnFilterChanged(object? sender, EventArgs e)
        {
            if (BindingContext is HomeViewModel viewModel)
            {
                viewModel.ApplyFilters();
            }
        }

        protected override async void OnAppearing()
        {
            base.OnAppearing();

            double screenWidth = DeviceDisplay.MainDisplayInfo.Width / DeviceDisplay.MainDisplayInfo.Density;
            if (AddTaskButton != null)
            {
                AddTaskButton.WidthRequest = screenWidth / 3;
            }

            HeaderGrid.Opacity = 0;
            AddTaskFrame.Opacity = 0;
            MainRefreshView.Opacity = 0;

            await Task.Delay(200);

            await HeaderGrid.FadeTo(1, 300);
            await AddTaskFrame.FadeTo(1, 300);
            await MainRefreshView.FadeTo(1, 300);
        }

        protected override void OnSizeAllocated(double width, double height)
        {
            base.OnSizeAllocated(width, height);

            if (width > 0 && AddTaskButton != null)
            {
                AddTaskButton.WidthRequest = width / 2;
            }
        }

        private async void OnTaskTapped(object sender, EventArgs e)
        {
            if (sender is VisualElement element && element.BindingContext is TaskModel task)
            {
                task.IsExpanded = !task.IsExpanded;

                if (element is Label descriptionLabel)
                {
                    double currentHeight = descriptionLabel.Height;
                    double targetHeight = task.IsExpanded ? currentHeight * 3 : currentHeight / 3;

                    var animation = new Animation(v => descriptionLabel.HeightRequest = v,
                                                  currentHeight, targetHeight,
                                                  easing: Easing.CubicInOut);

                    animation.Commit(this, "descExpand", length: 500);
                }
            }
        }

    }
}