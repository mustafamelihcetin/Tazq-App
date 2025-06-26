using Tazq_Frontend.Views;
using Microsoft.Maui.Controls;
using Tazq_Frontend.Helpers;

namespace Tazq_Frontend
{
    public partial class AppShell : Shell
    {
        public AppShell()
        {
            InitializeComponent();

            Routing.RegisterRoute(RouteNames.LoginPage, typeof(LoginPage));
            Routing.RegisterRoute(RouteNames.RegisterPage, typeof(RegisterPage));
            Routing.RegisterRoute(RouteNames.HomePage, typeof(HomePage));
            Routing.RegisterRoute(RouteNames.AddTaskPage, typeof(AddTaskPage));
            Routing.RegisterRoute(RouteNames.ForgotPasswordPage, typeof(ForgotPasswordPage));
            Routing.RegisterRoute(RouteNames.ResetPasswordPage, typeof(ResetPasswordPage));
            Routing.RegisterRoute(RouteNames.EditTaskPage, typeof(EditTaskPage));
        }
    }
}