using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Maui.Storage;
using Tazq_Frontend.ViewModels;
using Tazq_Frontend.Services;
using Microsoft.Maui.Controls;
using Tazq_Frontend.Helpers;

namespace Tazq_Frontend.ViewModels;

public partial class NotificationSettingsViewModel : ObservableObject
{
    private readonly ApiService _apiService;

    public NotificationSettingsViewModel(ApiService apiService)
    {
        _apiService = apiService;
        ReminderDays = Preferences.Default.Get(nameof(ReminderDays), 1);
        EmailNotificationEnabled = Preferences.Default.Get(nameof(EmailNotificationEnabled), true);
        var timeString = Preferences.Default.Get(nameof(NotificationTimeOfDay), "09:00");
        if (TimeSpan.TryParse(timeString, out var time))
            NotificationTimeOfDay = time;
        else
            NotificationTimeOfDay = TimeSpan.FromHours(9);
    }


    [ObservableProperty]
    private int reminderDays;

    [ObservableProperty]
    private bool emailNotificationEnabled;

    [ObservableProperty]
    private TimeSpan notificationTimeOfDay;

    partial void OnNotificationTimeOfDayChanged(TimeSpan value)
    {
        Preferences.Default.Set(nameof(NotificationTimeOfDay), value.ToString());
    }

    partial void OnReminderDaysChanged(int value)
    {
        Preferences.Default.Set(nameof(ReminderDays), value);
    }

    partial void OnEmailNotificationEnabledChanged(bool value)
    {
        Preferences.Default.Set(nameof(EmailNotificationEnabled), value);
    }

    [RelayCommand]
    private async Task Save()
    {
        await Shell.Current.GoToAsync($"///{RouteNames.HomePage}");
    }

    [RelayCommand]
    private async Task DeleteAccount()
    {
        bool confirm = await Application.Current!.MainPage!.DisplayAlert(
            "Hesabı Sil",
            "Hesabınızı ve tüm verilerinizi kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
            "Evet, Sil",
            "Hayır");

        if (confirm)
        {
            var success = await _apiService.DeleteAccount();
            if (success)
            {
#if ANDROID || IOS || MACCATALYST
                await SecureStorage.Default.SetAsync("jwt_token", string.Empty);
#endif
                await Application.Current.MainPage.DisplayAlert("Bilgi", "Hesabınız başarıyla silindi.", "Tamam");
                await Shell.Current.GoToAsync($"//{RouteNames.LoginPage}");
            }
            else
            {
                await Application.Current.MainPage.DisplayAlert("Hata", "Hesap silinirken bir sorun oluştu.", "Tamam");
            }
        }
    }
}