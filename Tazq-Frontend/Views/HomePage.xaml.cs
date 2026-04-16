using System;
using Tazq_Frontend.ViewModels;
using Tazq_Frontend.Models;
using Microsoft.Maui.Controls;
using Microsoft.Maui.Devices;
using System.Threading.Tasks;
using Microsoft.Maui; // for AppTheme
using Microsoft.Maui.Graphics; // for Color and GradientStop
using CommunityToolkit.Mvvm.Input;
using Microsoft.Extensions.DependencyInjection;

namespace Tazq_Frontend.Views
{
    public partial class HomePage : ContentPage
    {
        public IAsyncRelayCommand RefreshCommand { get; }
        public IAsyncRelayCommand<object?> TaskTappedCommand { get; }
        public IAsyncRelayCommand<object?> TaskContextChangedCommand { get; }

        public HomePage()
        {
            InitializeComponent();
            var viewModel = MauiProgram.Services?.GetService<HomeViewModel>() ?? throw new InvalidOperationException("HomeViewModel not found");
            BindingContext = viewModel;
            
            Console.WriteLine("[DOTNET] HomePage yüklendi.");

            RefreshCommand = new AsyncRelayCommand(OnRefreshAsync);
            TaskTappedCommand = new AsyncRelayCommand<object?>(OnTaskTappedAsync);
            TaskContextChangedCommand = new AsyncRelayCommand<object?>(OnTaskContextChangedAsync);
        }

        protected override async void OnAppearing()
        {
            base.OnAppearing();

            HeaderGrid.Opacity = 0;
            MainRefreshView.Opacity = 0;

            if (LoadingIndicator != null)
            {
                LoadingIndicator.Opacity = 1;
                LoadingIndicator.IsVisible = true;
                LoadingIndicator.IsRunning = true;
            }

            await Task.Delay(400);

            if (LoadingIndicator != null)
            {
                await LoadingIndicator.FadeTo(0, 200);
                LoadingIndicator.IsRunning = false;
                LoadingIndicator.IsVisible = false;
            }

            await HeaderGrid.FadeTo(1, 300);
            await MainRefreshView.FadeTo(1, 400);

            if (LogoImage.Opacity == 0)
            {
                await LogoImage.FadeTo(1, 500, Easing.SinOut);
                await LogoImage.ScaleTo(1.1, 400, Easing.CubicOut);
                await LogoImage.ScaleTo(1.0, 300, Easing.CubicIn);
            }
        }

        protected override void OnDisappearing()
        {
            base.OnDisappearing();

            if (BindingContext is HomeViewModel viewModel)
                viewModel.ResetTaskExpansions();
        }

        private async Task OnRefreshAsync()
        {
            if (BindingContext is HomeViewModel viewModel)
            {
                await viewModel.LoadTasksAsync();
                await Task.Delay(50);
                MainCollectionView.ScrollTo(0, position: ScrollToPosition.Start, animate: false);
            }

            MainRefreshView.IsRefreshing = false;
        }

        private void OnFilterChanged(object? sender, EventArgs e)
        {
            if (BindingContext is HomeViewModel viewModel)
                viewModel.ApplyFilters();
        }

        private async Task OnTaskTappedAsync(object? param)
        {
            if (param is Frame frame && frame.BindingContext is TaskModel task)
            {
                double startHeight = frame.Height;
                await MainThread.InvokeOnMainThreadAsync(() => this.InvalidateMeasure());
                await Task.Yield();

                double targetHeight = frame.Measure(frame.Width, double.PositiveInfinity).Request.Height;
                if (Math.Abs(targetHeight - startHeight) < 0.5)
                    return;

                var tcs = new TaskCompletionSource<bool>();
                var animation = new Animation(v => frame.HeightRequest = v,
                                              startHeight, targetHeight,
                                              easing: Easing.CubicInOut);
                animation.Commit(this, "frameExpand", length: 300,
                    finished: (v, c) => { frame.HeightRequest = -1; tcs.SetResult(true); });
                await tcs.Task;
            }
        }

        private async Task OnTaskContextChangedAsync(object? param)
        {
            if (param is Frame frame && frame.BindingContext is TaskModel task)
            {
                if (task.IsDueTodayAndNotCompleted)
                {
                    var label = frame.FindByName<Label>("DueDateLabel");
                    if (label != null && label.Opacity == 0)
                    {
                        await Task.WhenAll(
                            label.FadeTo(1, 400, Easing.CubicInOut),
                            label.ScaleTo(1, 400, Easing.SpringOut)
                        );
                    }
                }
            }
        }
    }
}
