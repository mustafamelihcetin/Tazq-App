using System;
using Tazq_Frontend.ViewModels;
using Tazq_Frontend.Models;
using Microsoft.Maui.Controls;
using Microsoft.Maui.Devices;
using Microsoft.Maui.Platform;
using System.Threading.Tasks;

#if ANDROID
using Android.Graphics.Drawables;
using Android.Views;
#endif

#if IOS
using UIKit;
using CoreAnimation;
using Foundation;
#endif

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

        protected override async void OnAppearing()
        {
            base.OnAppearing();

            double screenWidth = DeviceDisplay.MainDisplayInfo.Width / DeviceDisplay.MainDisplayInfo.Density;
            if (AddTaskButton != null)
                AddTaskButton.WidthRequest = screenWidth / 3;

            HeaderGrid.Opacity = 0;
            AddTaskFrame.Opacity = 0;
            MainRefreshView.Opacity = 0;

            await Task.Delay(200);

            await HeaderGrid.FadeTo(1, 300);
            await AddTaskFrame.FadeTo(1, 300);
            await MainRefreshView.FadeTo(1, 300);
        }

        public static void AnimateIfToday(Frame frame, TaskModel task)
        {
            if (!task.IsToday || frame.Handler?.PlatformView == null)
                return;

#if ANDROID
            if (frame.Handler.PlatformView is Android.Views.View nativeView && nativeView.Background is GradientDrawable drawable)
            {
                _ = AnimateBorderAndroid(drawable);
            }
#elif IOS
            if (frame.Handler.PlatformView is UIView nativeView)
            {
                _ = AnimateBorderIOS(nativeView.Layer);
            }
#endif
        }

        private void Frame_HandlerChanged(object? sender, EventArgs e)
        {
            if (sender is Frame frame && frame.BindingContext is TaskModel task)
            {
                AnimateIfToday(frame, task);
            }
        }

#if ANDROID
        private static async Task AnimateBorderAndroid(GradientDrawable drawable)
        {
            var baseColor = Android.Graphics.Color.Rgb(60, 125, 255);
            drawable.SetStroke(1, baseColor);
            while (true)
            {
                for (float i = 1; i <= 2; i += 0.2f)
                {
                    drawable.SetStroke((int)i, baseColor);
                    await Task.Delay(350);
                }
                for (float i = 2; i >= 1; i -= 0.2f)
                {
                    drawable.SetStroke((int)i, baseColor);
                    await Task.Delay(350);
                }
            }
        }
#endif

#if IOS
        private static async Task AnimateBorderIOS(CALayer layer)
        {
            await MainThread.InvokeOnMainThreadAsync(async () =>
            {
                layer.BorderColor = UIColor.FromRGB(60, 125, 255).CGColor;
                layer.MasksToBounds = true;

                while (true)
                {
                    for (nfloat i = 1; i <= 2; i += 0.2f)
                    {
                        layer.BorderWidth = i;
                        await Task.Delay(300);
                    }
                    for (nfloat i = 2; i >= 1; i -= 0.2f)
                    {
                        layer.BorderWidth = i;
                        await Task.Delay(300);
                    }
                }
            });
        }
#endif

        protected override void OnSizeAllocated(double width, double height)
        {
            base.OnSizeAllocated(width, height);
            if (width > 0 && AddTaskButton != null)
                AddTaskButton.WidthRequest = width / 2;
        }

        private async void MainRefreshView_Refreshing(object sender, EventArgs e)
        {
            if (BindingContext is HomeViewModel viewModel)
            {
                await viewModel.LoadTasksAsync();
                viewModel.IsScrolledDown = true;
            }

            MainRefreshView.IsRefreshing = false;
        }

        private void MainRefreshView_Scrolled(object sender, ScrolledEventArgs e)
        {
            if (BindingContext is HomeViewModel viewModel)
                viewModel.IsScrolledDown = e.ScrollY > 30;
        }

        private void OnStatusFilterChanged(object sender, CheckedChangedEventArgs e)
        {
            if (BindingContext is HomeViewModel vm && e.Value)
            {
                vm.FilterByCompleted = null;
                if (vm.IsStatusCompleted) vm.FilterByCompleted = true;
                else if (vm.IsStatusIncomplete) vm.FilterByCompleted = false;
                vm.ApplyFilters();
            }
        }

        private void OnFilterChanged(object? sender, EventArgs e)
        {
            if (BindingContext is HomeViewModel viewModel)
                viewModel.ApplyFilters();
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