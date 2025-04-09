using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using Tazq_Frontend.Models;
using Tazq_Frontend.Services;
using Microsoft.Maui.Controls;
using System.Windows.Input;

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
            DeleteTaskCommand = new AsyncRelayCommand<TaskModel?>(DeleteTask);

            LoadTasksCommand.Execute(null);
        }

        [ObservableProperty]
        private ObservableCollection<TaskModel> tasks;

        public IAsyncRelayCommand LoadTasksCommand { get; }
        public IAsyncRelayCommand LogoutCommand { get; }
        public IAsyncRelayCommand SettingsCommand { get; }
        public ICommand TogglePastTasksCommand { get; }
        // Remove the explicit definition of EditTaskCommand since it's generated automatically
        public IAsyncRelayCommand<TaskModel?> DeleteTaskCommand { get; }

        [ObservableProperty]
        private bool isLoading;

        [ObservableProperty]
        private bool showPastTasks;

        [ObservableProperty]
        private bool isScrolledDown;

        private async Task LoadTasks()
        {
            IsLoading = true;

            try
            {
                Console.WriteLine("[DOTNET] Görevler API çağrılıyor...");

                var taskList = await _apiService.GetTasks();

                Console.WriteLine($"[DOTNET] Gelen görev sayısı: {taskList?.Count}");

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
                Console.WriteLine($"[DOTNET] Görev çekme hatası: {ex.Message}");

                await Application.Current.MainPage.DisplayAlert("Hata", "Görevler alınamadı: " + ex.Message, "Tamam");
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
            await Shell.Current.GoToAsync("AddTaskPage");
        }

        [RelayCommand]
        private async Task EditTask(TaskModel? task)
        {
            if (task != null)
            {
                await Shell.Current.GoToAsync($"///EditTaskPage?taskId={task.Id}");
            }
        }

        private async Task DeleteTask(TaskModel? task)
        {
            if (task == null)
                return;

            var confirmed = await Application.Current.MainPage.DisplayAlert("Görevi Sil", $"'{task.Title}' silinsin mi?", "Evet", "Hayır");
            if (confirmed)
            {
                await _apiService.DeleteTask(task.Id);
                await LoadTasks();
            }
        }
    }
}