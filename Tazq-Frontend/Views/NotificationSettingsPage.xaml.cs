using Tazq_Frontend.ViewModels;

namespace Tazq_Frontend.Views;

public partial class NotificationSettingsPage : ContentPage
{
    public NotificationSettingsPage()
    {
        InitializeComponent();
        BindingContext = new NotificationSettingsViewModel();
    }
}