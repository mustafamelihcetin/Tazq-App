using System.Collections.ObjectModel;
using System.Windows.Input;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;
using Microsoft.Maui.Controls;
using Tazq_Frontend.Models;
using Tazq_Frontend.Services;
using Tazq_Frontend.Views;
using Microsoft.Maui.Storage;
using System.Threading.Tasks;

namespace Tazq_Frontend.ViewModels
{
    public partial class HomeViewModel : ObservableObject
    {
        private readonly ApiService _apiService;

        public HomeViewModel()
        {
            _apiService = new ApiService();
            Tasks = new ObservableCollection<TaskModel>();
            LoadTasksCommand = new AsyncRelayCommand(LoadTasks);
            LogoutCommand = new AsyncRelayCommand(Logout);
            SettingsCommand = new AsyncRelayCommand(OpenSettings);
            TogglePastTasksCommand = new RelayCommand(TogglePastTasks);

            LoadTasksCommand.Execute(null);

            WeakReferenceMessenger.Default.Register<TaskAddedMessage>(this, async (r, m) =>
            {
                await LoadTasks();
            });
        }

        [ObservableProperty]
        private ObservableCollection<TaskModel> tasks = new();

        public IAsyncRelayCommand LoadTasksCommand { get; }
        public IAsyncRelayCommand LogoutCommand { get; }
        public IAsyncRelayCommand SettingsCommand { get; }
        public ICommand TogglePastTasksCommand { get; }

        [ObservableProperty]
        private bool isLoading = false;

        [ObservableProperty]
        private bool showPastTasks = false;

        [ObservableProperty]
        private bool isScrolledDown = false;

        private async Task LoadTasks()
        {
            IsLoading = true;
            try
            {
                var taskList = await _apiService.GetTasks();
                Tasks.Clear();

                if (taskList != null)
                {
                    foreach (var task in taskList)
                    {
                        if (ShowPastTasks || !task.IsExpired)
                        {
                            Tasks.Add(task);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Hata: {ex.Message}");
            }
            finally
            {
                IsLoading = false;
            }
        }

        private void TogglePastTasks()
        {
            ShowPastTasks = !ShowPastTasks;
            LoadTasksCommand.Execute(null);
        }

        private async Task Logout()
        {
#if ANDROID || IOS || MACCATALYST
            await SecureStorage.Default.SetAsync("jwt_token", string.Empty);
#endif
            if (Shell.Current != null)
            {
                await Shell.Current.GoToAsync("//LoginPage");
            }
        }

        private async Task OpenSettings()
        {
#if ANDROID || IOS || MACCATALYST
            await Application.Current?.MainPage?.DisplayAlert("Ayarlar", "Ayarlar sayfası yakında gelecek.", "Tamam");
#endif
        }

        [RelayCommand]
        private async Task GoToAddTaskPage()
        {
            await Shell.Current.GoToAsync(nameof(AddTaskPage));
        }
    }
}