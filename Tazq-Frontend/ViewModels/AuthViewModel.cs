using System.Windows.Input;
using Tazq_Frontend.Services;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Maui.Controls;
using Tazq_Frontend.Views;
using Tazq_Frontend.Helpers;
using Microsoft.Maui.Storage;


namespace Tazq_Frontend.ViewModels
{
    public partial class AuthViewModel : ObservableObject
    {
        private readonly ApiService _apiService;

        public AuthViewModel(ApiService apiService)
        {
            _apiService = apiService;
        }

        public AuthViewModel() : this(MauiProgram.Services!.GetRequiredService<ApiService>())
        {
        }

        private string _email = string.Empty;
        public string Email
        {
            get => _email;
            set => SetProperty(ref _email, value);
        }

        private string _password = string.Empty;
        public string Password
        {
            get => _password;
            set => SetProperty(ref _password, value);
        }

        private bool isLoading;
        public bool IsLoading
        {
            get => isLoading;
            set => SetProperty(ref isLoading, value);
        }

        private bool showForgotPassword;
        public bool ShowForgotPassword
        {
            get => showForgotPassword;
            set => SetProperty(ref showForgotPassword, value);
        }

        private bool isLightThemeEnabled = Application.Current?.UserAppTheme == AppTheme.Light;
        public bool IsLightThemeEnabled
        {
            get => isLightThemeEnabled;
            set
            {
                if (SetProperty(ref isLightThemeEnabled, value))
                {
                    Preferences.Default.Set("IsLightThemeEnabled", value);
                    if (Application.Current != null)
                    {
                        Application.Current.UserAppTheme = value ? AppTheme.Light : AppTheme.Dark;
                    }
                }
            }
        }

        public ICommand NavigateToRegisterCommand => new AsyncRelayCommand(async () =>
        {
            if (Shell.Current != null)
            {
                await Shell.Current.GoToAsync($"///{RouteNames.RegisterPage}");
            }
            else if (Application.Current?.MainPage != null)
            {
                await Application.Current.MainPage.DisplayAlert("Hata", "Navigasyon hatası oluştu!", "Tamam");
            }
        });

        public ICommand NavigateToLoginCommand => new AsyncRelayCommand(async () =>
        {
            if (Shell.Current != null)
            {
                await Shell.Current.GoToAsync($"///{RouteNames.LoginPage}");
            }
            else if (Application.Current?.MainPage != null)
            {
                await Application.Current.MainPage.DisplayAlert("Hata", "Navigasyon hatası oluştu!", "Tamam");
            }
        });

        public ICommand NavigateToResetPasswordCommand => new AsyncRelayCommand(async () =>
        {
            if (Shell.Current != null)
            {
                await Shell.Current.GoToAsync($"///{nameof(ForgotPasswordPage)}");
            }
            else if (Application.Current?.MainPage != null)
            {
                await Application.Current.MainPage.DisplayAlert("Hata", "Navigasyon hatası oluştu!", "Tamam");
            }
        });

        public ICommand LoginCommand => new AsyncRelayCommand(async () =>
        {
            IsLoading = true;
            ShowForgotPassword = false;

            try
            {
                if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
                {
                    IsLoading = false;

                    var page = Application.Current?.MainPage;
                    if (page != null)
                    {
                        await page.DisplayAlert("Hata", "E-posta ve şifre boş olamaz!", "Tamam");
                    }
                    return;
                }

                Console.WriteLine("Giriş denemesi yapılıyor...");

                bool loginSuccess = await _apiService.Login(Email, Password);

                var currentPage = Application.Current?.MainPage;

                if (loginSuccess)
                {
                    IsLoading = false;

                    if (Shell.Current != null)
                        await Shell.Current.GoToAsync($"///{RouteNames.HomePage}");
                }
                else
                {
                    IsLoading = false;
                    ShowForgotPassword = true;

                    if (currentPage != null)
                        await currentPage.DisplayAlert("Hata", "Geçersiz giriş bilgileri! Lütfen tekrar deneyin.", "Tamam");
                }
            }
            catch (Exception ex)
            {
                IsLoading = false;
                ShowForgotPassword = true;

                var currentPage = Application.Current?.MainPage;
                if (currentPage != null)
                    await currentPage.DisplayAlert("Hata", "Bir hata oluştu, lütfen tekrar deneyin.", "Tamam");
            }
        });

        public ICommand RegisterCommand => new AsyncRelayCommand(async () =>
        {
            IsLoading = true;

            try
            {
                if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
                {
                    IsLoading = false;

                    var page = Application.Current?.MainPage;
                    if (page != null)
                    {
                        await page.DisplayAlert("Hata", "E-posta ve şifre boş olamaz!", "Tamam");
                    }
                    return;
                }

                Console.WriteLine("Kayıt denemesi yapılıyor...");

                string name = "Kullanıcı";
                var (success, errorMessage) = await _apiService.RegisterWithMessage(Email, name, Password);

                IsLoading = false;

                var currentPage = Application.Current?.MainPage;

                if (success)
                {
                    if (currentPage != null)
                        await currentPage.DisplayAlert("Başarılı", "Kayıt işlemi tamamlandı!", "Tamam");

                    if (Shell.Current != null)
                        await Shell.Current.GoToAsync($"///{RouteNames.LoginPage}");
                }
                else
                {
                    if (currentPage != null)
                        await currentPage.DisplayAlert("Hata", "Kayıt başarısız oldu, lütfen tekrar deneyin.", "Tamam");
                }
            }
            catch (Exception ex)
            {
                IsLoading = false;

                var page = Application.Current?.MainPage;
                if (page != null)
                    await page.DisplayAlert("Hata", "Bir hata oluştu, lütfen tekrar deneyin.", "Tamam");
            }
        });

        public ICommand NavigateToForgotPasswordCommand => new AsyncRelayCommand(async () =>
        {
            if (Shell.Current != null)
            {
                await Shell.Current.GoToAsync($"///{RouteNames.ResetPasswordPage}");
            }
            else if (Application.Current?.MainPage != null)
            {
                await Application.Current.MainPage.DisplayAlert("Hata", "Navigasyon hatası oluştu!", "Tamam");
            }
        });


    }
}