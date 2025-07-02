using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using Tazq_Frontend.Models;
using Tazq_Frontend.Services;
using Microsoft.Maui.Controls;
using System.Windows.Input;
using CommunityToolkit.Mvvm.Messaging;
using Tazq_Frontend.Helpers;
using Microsoft.Maui.Storage;

namespace Tazq_Frontend.ViewModels
{
    public partial class HomeViewModel : ObservableObject
    {
        private readonly ApiService _apiService;

        public HomeViewModel(ApiService apiService)
        {
            _apiService = apiService;
            Tasks = new ObservableCollection<TaskModel>();
            FilteredTasks = new ObservableCollection<TaskModel>();
            LoadTasksCommand = new AsyncRelayCommand(LoadTasks);
            LogoutCommand = new AsyncRelayCommand(Logout);
            DeleteTaskCommand = new AsyncRelayCommand<TaskModel?>(DeleteTask);
            ToggleTaskCompletionCommand = new AsyncRelayCommand<TaskModel?>(ToggleTaskCompletion);
            ToggleFilterPanelCommand = new RelayCommand(ToggleFilterPanel);
            ToggleSettingsPanelCommand = new RelayCommand(ToggleSettingsPanel);
            EditTaskCommand = new AsyncRelayCommand<TaskModel?>(EditTask);

            IsShowOnlyIncomplete = Preferences.Default.Get(nameof(IsShowOnlyIncomplete), false);
            ShowPastTasks = Preferences.Default.Get(nameof(ShowPastTasks), false);

            WeakReferenceMessenger.Default.Register<TaskAddedMessage>(this, async (r, m) =>
            {
                await LoadTasks();
            });

            WeakReferenceMessenger.Default.Register<TaskUpdatedMessage>(this, async (r, m) =>
            {
                await LoadTasks();
            });

            LoadTasksCommand.Execute(null);

            this.PropertyChanged += (s, e) =>
            {
                Console.WriteLine($"[DEBUG] Property changed: {e.PropertyName}");
            };
        }

        public HomeViewModel() : this(MauiProgram.Services!.GetRequiredService<ApiService>())
        {
        }

        [ObservableProperty]
        private ObservableCollection<TaskModel> tasks = new();

        [ObservableProperty]
        private bool isLoading = false;

        private bool isScrolledDown = true;

        public bool IsScrolledDown
        {
            get => isScrolledDown;
            set
            {
                if (SetProperty(ref isScrolledDown, value))
                {
                    Console.WriteLine($"[DEBUG] IsScrolledDown changed to: {value}");
                }
            }
        }

        private bool _canScroll;
        public bool CanScroll
        {
            get => _canScroll;
            set => SetProperty(ref _canScroll, value);
        }

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

        [ObservableProperty]
        private string statusFilterLabel = "Tümü";

        [ObservableProperty]
        private string showPastTasksLabel = "Gizle";

        [ObservableProperty]
        private bool isSettingsPanelVisible = false;

        [ObservableProperty]
        private bool isLightThemeEnabled = Application.Current?.RequestedTheme == AppTheme.Light;



        public IAsyncRelayCommand<TaskModel?> EditTaskCommand { get; }
        public IAsyncRelayCommand LoadTasksCommand { get; }
        public IAsyncRelayCommand LogoutCommand { get; }
        public ICommand TogglePastTasksCommand { get; } = new RelayCommand(() => { });
        public IAsyncRelayCommand<TaskModel?> DeleteTaskCommand { get; }
        public IAsyncRelayCommand<TaskModel?> ToggleTaskCompletionCommand { get; }
        public ICommand ToggleFilterPanelCommand { get; }
        public ICommand ToggleSettingsPanelCommand { get; }
        public IRelayCommand<TaskModel> AnimateDueDateCommand => new RelayCommand<TaskModel>(async (task) =>
        {
            if (task == null) return;

            task.AnimateDueDate = true;
            await Task.Delay(50);
            task.AnimateDueDate = false;
        });


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
                        ApplyFilters();
                    });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DOTNET] Görev çekme hatası: {ex.Message}");
                var page = Application.Current?.MainPage;
                if (page != null)
                {
                    await page.DisplayAlert("Hata", "Görevler alınamadı: " + ex.Message, "Tamam");
                }
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
                    ApplyFilters();
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

        private async Task Logout()
        {
#if ANDROID || IOS || MACCATALYST
            await SecureStorage.Default.SetAsync("jwt_token", string.Empty);
#endif
            if (Shell.Current != null)
            {
                await Shell.Current.GoToAsync($"//{RouteNames.LoginPage}");
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
            ResetTaskExpansions();
            await Shell.Current.GoToAsync(RouteNames.AddTaskPage);
        }

        [RelayCommand]
        private async Task About()
        {
            ResetTaskExpansions();
            await Shell.Current.GoToAsync(RouteNames.AboutPage);
        }

        private async Task EditTask(TaskModel? task)
        {
            if (task != null)
            {
                Console.WriteLine($">>> EditTask yönlendirme: {task.Id}");
                await Shell.Current.GoToAsync($"{RouteNames.EditTaskPage}?taskId={task.Id}");
            }
        }

        [RelayCommand]
        private async Task NotificationSettings()
        {
            ResetTaskExpansions();
            await Shell.Current.GoToAsync(RouteNames.NotificationSettingsPage);
        }


        public void ApplyFilters()
        {
            if (Tasks == null)
                return;

            var filtered = Tasks.AsEnumerable();

            if (!ShowPastTasks)
                filtered = filtered.Where(t => !t.IsExpired);

            if (FilterByCompleted.HasValue)
                filtered = filtered.Where(t => t.IsCompleted == FilterByCompleted.Value);

            if (!string.IsNullOrWhiteSpace(FilterTag))
                filtered = filtered.Where(t => t.Tags != null && t.Tags.Any(tag =>
                    tag.Contains(FilterTag, StringComparison.OrdinalIgnoreCase)));

            FilteredTasks.Clear();
            foreach (var task in filtered)
                FilteredTasks.Add(task);
        }

        private void ToggleExpand(TaskModel task, bool toggleTitle)
        {
            bool willExpand = toggleTitle ? !task.IsTitleExpanded : !task.IsDescriptionExpanded;

            if (willExpand)
            {
                foreach (var other in FilteredTasks.ToList())
                {
                    if (ReferenceEquals(other, task))
                        continue;

                    if (toggleTitle && other.IsTitleExpanded)
                    {
                        other.IsTitleExpanded = false;
                    }
                    else if (!toggleTitle && other.IsDescriptionExpanded)
                    {
                        other.IsDescriptionExpanded = false;
                    }

                    var otherIndex = FilteredTasks.IndexOf(other);
                    if (otherIndex >= 0)
                    {
                        FilteredTasks.RemoveAt(otherIndex);
                        FilteredTasks.Insert(otherIndex, other);
                    }
                }
            }

            if (toggleTitle)
            {
                task.IsTitleExpanded = willExpand;
                if (willExpand) task.IsDescriptionExpanded = false;
            }
            else
            {
                task.IsDescriptionExpanded = willExpand;
                if (willExpand) task.IsTitleExpanded = false;
            }

            var index = FilteredTasks.IndexOf(task);
            if (index >= 0)
            {
                FilteredTasks.RemoveAt(index);
                FilteredTasks.Insert(index, task);
            }
        }

        [RelayCommand]
        private void ToggleTitleExpand(TaskModel task)
        {
            ToggleExpand(task, true);
        }

        [RelayCommand]
        private void ToggleDescriptionExpand(TaskModel task)
        {
            ToggleExpand(task, false);
        }


        private async Task DeleteTask(TaskModel? task)
        {
            if (task == null)
                return;

            var page = Application.Current?.MainPage;
            bool confirmed = false;
            if (page != null)
            {
                confirmed = await page.DisplayAlert("Görevi Sil", $"'{task.Title}' silinsin mi?", "Evet", "Hayır");
            }
            if (confirmed)
            {
                await _apiService.DeleteTask(task.Id);
                await LoadTasks();
            }
        }
        private async Task AnimateLabelChange(Label label, string newText)
        {
            await Task.WhenAll(
                label.FadeTo(0, 150),
                label.ScaleTo(0.8, 150)
            );

            label.Text = newText;

            await Task.WhenAll(
                label.FadeTo(1, 150),
                label.ScaleTo(1.0, 150)
            );
        }


        private async Task ToggleTaskCompletion(TaskModel? task)
        {
            if (task == null)
                return;

            task.IsCompleted = !task.IsCompleted;
            await _apiService.UpdateTask(task);
            await LoadTasks();
        }
        [ObservableProperty]
        private bool isShowOnlyIncomplete;
        partial void OnIsShowOnlyIncompleteChanged(bool value)
        {
            Preferences.Default.Set(nameof(IsShowOnlyIncomplete), value);
            _ = UpdateStatusLabelAsync();
        }

        private async Task UpdateStatusLabelAsync()
        {
            StatusFilterLabel = IsShowOnlyIncomplete ? "Tamamlanmadı" : "Tümü";
            FilterByCompleted = IsShowOnlyIncomplete ? false : null;
            ApplyFilters();

            if (Application.Current.MainPage is ContentPage page)
            {
                var label = page.FindByName<Label>("StatusFilterLabel");
                if (label != null)
                    await AnimateLabelChange(label, StatusFilterLabel);
            }
        }
        [ObservableProperty]
        private bool showPastTasks;
        partial void OnShowPastTasksChanged(bool value)
        {
            Preferences.Default.Set(nameof(ShowPastTasks), value);
            _ = UpdatePastTasksLabelAsync();
        }

        private async Task UpdatePastTasksLabelAsync()
        {
            ShowPastTasksLabel = ShowPastTasks ? "Göster" : "Gizle";
            LoadTasksCommand.Execute(null);

            if (Application.Current.MainPage is ContentPage page)
            {
                var label = page.FindByName<Label>("ShowPastTasksLabelRef");
                if (label != null)
                    await AnimateLabelChange(label, ShowPastTasksLabel);
            }
        }
        private void ToggleSettingsPanel()
        {
            IsSettingsPanelVisible = !IsSettingsPanelVisible;
        }
        partial void OnIsLightThemeEnabledChanged(bool value)
        {
            Preferences.Default.Set("IsLightThemeEnabled", value);
            if (App.Current != null)
            {
                App.Current.UserAppTheme = value ? AppTheme.Light : AppTheme.Dark;
            }
        }
        public void ResetTaskExpansions()
        {
            foreach (var task in FilteredTasks)
            {
                task.IsExpanded = false;
                task.IsTitleExpanded = false;
                task.IsDescriptionExpanded = false;
            }
        }
    }
}