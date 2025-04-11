using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using Tazq_Frontend.Models;
using Tazq_Frontend.Services;
using Microsoft.Maui.Controls;
using System.Windows.Input;
using CommunityToolkit.Mvvm.Messaging;

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
            ToggleTaskCompletionCommand = new AsyncRelayCommand<TaskModel?>(ToggleTaskCompletion);
            ToggleFilterPanelCommand = new RelayCommand(ToggleFilterPanel);

            WeakReferenceMessenger.Default.Register<TaskAddedMessage>(this, async (r, m) =>
            {
                await LoadTasks();
            });

            WeakReferenceMessenger.Default.Register<TaskUpdatedMessage>(this, async (r, m) =>
            {
                await LoadTasks();
            });

            LoadTasksCommand.Execute(null);
        }

        [ObservableProperty]
        private ObservableCollection<TaskModel> tasks;

        [ObservableProperty]
        private bool isLoading;

        [ObservableProperty]
        private bool showPastTasks = false;

        [ObservableProperty]
        private bool isScrolledDown;

        [ObservableProperty]
        private bool filterCompleted;

        [ObservableProperty]
        private bool filterIncomplete;

        [ObservableProperty]
        private string filterTag = string.Empty;

        [ObservableProperty]
        private bool? filterByCompleted = null;

        [ObservableProperty]
        private ObservableCollection<TaskModel> filteredTasks = new();

        [ObservableProperty]
        private bool isFilterPanelVisible = false;

        public IAsyncRelayCommand LoadTasksCommand { get; }
        public IAsyncRelayCommand LogoutCommand { get; }
        public IAsyncRelayCommand SettingsCommand { get; }
        public ICommand TogglePastTasksCommand { get; }
        public IAsyncRelayCommand<TaskModel?> DeleteTaskCommand { get; }
        public IAsyncRelayCommand<TaskModel?> ToggleTaskCompletionCommand { get; }
        public ICommand ToggleFilterPanelCommand { get; }

        private void ToggleFilterPanel()
        {
            IsFilterPanelVisible = !IsFilterPanelVisible;
        }

        private async Task LoadTasks()
        {
            IsLoading = true;

            try
            {
                Console.WriteLine("[DOTNET] Görevler API çağrılıyor...");

                var taskList = await _apiService.GetTasks();

                Console.WriteLine($"[DOTNET] Gelen görev sayısı: {taskList?.Count}");

                if (taskList != null)
                {
                    var ordered = taskList
                        .Where(t =>
                            (ShowPastTasks || !t.IsExpired) &&
                            (!FilterCompleted || t.IsCompleted) &&
                            (!FilterIncomplete || !t.IsCompleted) &&
                            (string.IsNullOrWhiteSpace(FilterTag) || (t.Tags != null && t.Tags.Any(tag => tag.Contains(FilterTag, StringComparison.OrdinalIgnoreCase))))
                        )
                        .OrderBy(t => t.DueDate ?? DateTime.MaxValue)
                        .ThenBy(t => t.DueTime ?? DateTime.MaxValue)
                        .ToList();

                    await MainThread.InvokeOnMainThreadAsync(() =>
                    {
                        Tasks.Clear();
                        foreach (var task in ordered)
                        {
                            Tasks.Add(task);
                        }
                    });
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

        public async Task LoadTasksAsync()
        {
            IsLoading = true;

            try
            {
                var tasks = await _apiService.GetTasks();

                var ordered = tasks
                    .Where(t =>
                        (ShowPastTasks || !t.IsExpired) &&
                        (!FilterCompleted || t.IsCompleted) &&
                        (!FilterIncomplete || !t.IsCompleted) &&
                        (string.IsNullOrWhiteSpace(FilterTag) || (t.Tags != null && t.Tags.Any(tag => tag.Contains(FilterTag, StringComparison.OrdinalIgnoreCase))))
                    )
                    .OrderBy(t => t.DueDate ?? DateTime.MaxValue)
                    .ThenBy(t => t.DueTime ?? DateTime.MaxValue)
                    .ToList();

                await MainThread.InvokeOnMainThreadAsync(() =>
                {
                    Tasks.Clear();
                    foreach (var task in ordered)
                    {
                        Tasks.Add(task);
                    }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DOTNET] Görev çekme hatası (async): {ex.Message}");
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
                Console.WriteLine($">>> EditTask yönlendirme: {task.Id}");
                await Shell.Current.GoToAsync($"EditTaskPage?taskId={task.Id}");
            }
        }

        public void ApplyFilters()
        {
            if (Tasks == null)
                return;

            var filtered = Tasks.AsEnumerable();

            if (FilterByCompleted.HasValue)
                filtered = filtered.Where(t => t.IsCompleted == FilterByCompleted.Value);

            if (!string.IsNullOrWhiteSpace(FilterTag))
                filtered = filtered.Where(t => t.Tags != null && t.Tags.Any(tag =>
                    tag.Contains(FilterTag, StringComparison.OrdinalIgnoreCase)));

            FilteredTasks = new ObservableCollection<TaskModel>(filtered);
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

        private async Task ToggleTaskCompletion(TaskModel? task)
        {
            if (task == null)
                return;

            task.IsCompleted = !task.IsCompleted;
            await _apiService.UpdateTask(task);
            await LoadTasks();
        }
    }
}