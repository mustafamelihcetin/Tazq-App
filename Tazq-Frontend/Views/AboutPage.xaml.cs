using Microsoft.Maui.Controls;
using Tazq_Frontend.ViewModels;

namespace Tazq_Frontend.Views;

public partial class AboutPage : ContentPage
{
    public AboutPage()
    {
        InitializeComponent();
        BindingContext = MauiProgram.Services?.GetService<AboutViewModel>() ?? new AboutViewModel();
    }

    private async void OnBackClicked(object sender, EventArgs e)
    {
        await Shell.Current.GoToAsync("..");
    }
}