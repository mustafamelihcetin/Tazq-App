using System;
using Tazq_Frontend.ViewModels;
using Tazq_Frontend.Models;
using Microsoft.Maui.Controls;
using System.Threading.Tasks;

namespace Tazq_Frontend.Views
{
    public partial class HomePage : ContentPage
    {
        private readonly HomeViewModel _viewModel;

        public HomePage()
        {
            InitializeComponent();
            _viewModel = MauiProgram.Services?.GetService<HomeViewModel>() ?? throw new InvalidOperationException("HomeViewModel not found");
            BindingContext = _viewModel;
        }

        protected override async void OnAppearing()
        {
            base.OnAppearing();
            
            // Trigger load if empty
            if (_viewModel.FilteredTasks.Count == 0)
            {
                await _viewModel.LoadTasksCommand.ExecuteAsync(null);
            }
        }

        private async void OnItemLoaded(object sender, EventArgs e)
        {
            if (sender is VisualElement element)
            {
                // Subtle staggered entrance
                await Task.Delay(Environment.TickCount % 200); 
                
                await Task.WhenAll(
                    element.FadeTo(1, 400, Easing.CubicOut),
                    element.TranslateTo(0, 0, 400, Easing.CubicOut)
                );
            }
        }
    }
}
