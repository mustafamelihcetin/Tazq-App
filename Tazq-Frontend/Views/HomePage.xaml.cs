using System;
using Tazq_Frontend.ViewModels;
using Tazq_Frontend.Models;
using Microsoft.Maui.Controls;
using Microsoft.Maui.Devices;
using System.Threading.Tasks;
using Microsoft.Maui; // for AppTheme
using Microsoft.Maui.Graphics; // for Color and GradientStop
using CommunityToolkit.Mvvm.Input;

namespace Tazq_Frontend.Views
{
    public partial class HomePage : ContentPage
    {
        private LinearGradientBrush _backgroundBrush;

        public IAsyncRelayCommand RefreshCommand { get; }
        public IAsyncRelayCommand<object?> TaskTappedCommand { get; }
        public IAsyncRelayCommand<object?> TaskContextChangedCommand { get; }

        public HomePage()
        {
            InitializeComponent();
            Console.WriteLine("[DOTNET] HomePage yüklendi.");

            RefreshCommand = new AsyncRelayCommand(OnRefreshAsync);
            TaskTappedCommand = new AsyncRelayCommand<object?>(OnTaskTappedAsync);
            TaskContextChangedCommand = new AsyncRelayCommand<object?>(OnTaskContextChangedAsync);
        }

        protected override async void OnAppearing()
        {
            base.OnAppearing();

            double screenWidth = DeviceDisplay.MainDisplayInfo.Width / DeviceDisplay.MainDisplayInfo.Density;
            if (AddTaskButton != null)
                AddTaskButton.WidthRequest = screenWidth / 3;

            HeaderGrid.Opacity = 0;
            AddTaskFrame.Opacity = 0;
            FilterButtonFrame.Opacity = 0;
            MainRefreshView.Opacity = 0;

            if (LoadingIndicator != null)
            {
                LoadingIndicator.Opacity = 1;
                LoadingIndicator.IsVisible = true;
                LoadingIndicator.IsRunning = true;
            }

            SetupDynamicBackground();
            Application.Current.RequestedThemeChanged += OnRequestedThemeChanged;

            await Task.Delay(600);

            if (LoadingIndicator != null)
            {
                await LoadingIndicator.FadeTo(0, 300);
                LoadingIndicator.IsRunning = false;
                LoadingIndicator.IsVisible = false;
            }

            await HeaderGrid.FadeTo(1, 300);
            await Task.WhenAll(
                AddTaskFrame.FadeTo(1, 300),
                FilterButtonFrame.FadeTo(1, 300)
            );
            await MainRefreshView.FadeTo(1, 300);

            if (LogoImage.Opacity == 0)
            {
                await LogoImage.FadeTo(1, 500, Easing.SinOut);
                await LogoImage.ScaleTo(1.1, 400, Easing.CubicOut);
                await LogoImage.ScaleTo(1.0, 300, Easing.CubicIn);

            }

        }

        private void OnRequestedThemeChanged(object sender, AppThemeChangedEventArgs e)
        {
            MainThread.BeginInvokeOnMainThread(SetupDynamicBackground);
        }

        private void SetupDynamicBackground()
        {
            _backgroundBrush = new LinearGradientBrush
            {
                StartPoint = new Point(0, 0),
                EndPoint = new Point(1, 1),
                GradientStops = new GradientStopCollection()
            };

            if (Application.Current.RequestedTheme == AppTheme.Light)
            {
                _backgroundBrush.GradientStops.Add(new GradientStop(Color.FromArgb("#F5F7FA"), 0.0f));
                _backgroundBrush.GradientStops.Add(new GradientStop(Color.FromArgb("#E4E7EB"), 0.3f));
                _backgroundBrush.GradientStops.Add(new GradientStop(Color.FromArgb("#D3D6DA"), 0.6f));
                _backgroundBrush.GradientStops.Add(new GradientStop(Color.FromArgb("#C2C5C9"), 0.85f));
                _backgroundBrush.GradientStops.Add(new GradientStop(Color.FromArgb("#B1B4B8"), 1.0f));
            }
            else
            {
                _backgroundBrush.GradientStops.Add(new GradientStop(Color.FromArgb("#1E1E1E"), 0.0f));
                _backgroundBrush.GradientStops.Add(new GradientStop(Color.FromArgb("#252525"), 0.25f));
                _backgroundBrush.GradientStops.Add(new GradientStop(Color.FromArgb("#2C2C2C"), 0.5f));
                _backgroundBrush.GradientStops.Add(new GradientStop(Color.FromArgb("#2F3239"), 0.75f));
                _backgroundBrush.GradientStops.Add(new GradientStop(Color.FromArgb("#1F2A38"), 1.0f));
            }

            this.Background = _backgroundBrush;
        }

        protected override void OnSizeAllocated(double width, double height)
        {
            base.OnSizeAllocated(width, height);
            if (width > 0 && AddTaskButton != null)
                AddTaskButton.WidthRequest = width / 2;
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

                await Task.Delay(10);
                this.InvalidateMeasure();
                await Task.Delay(10);

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

        private Label? FindDueDateLabel(Frame frame)
        {
            return frame.FindByName<Label>("DueDateLabel");
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