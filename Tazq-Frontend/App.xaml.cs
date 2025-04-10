using Tazq_Frontend.Views;

namespace Tazq_Frontend;

public partial class App : Application
{
    public App()
    {
        InitializeComponent();
        MainPage = new AppShell();
    }
}