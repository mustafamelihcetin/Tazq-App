using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;
using System.Collections.ObjectModel;
using Tazq_Frontend.Models;
using Tazq_Frontend.Services;
using Tazq_Frontend.Helpers;

namespace Tazq_Frontend.ViewModels
{
    public partial class EditTaskViewModel : ObservableObject
    {
        private readonly ApiService _apiService;

        public EditTaskViewModel(ApiService apiService)
        {
            _apiService = apiService;
            Tags = new ObservableCollection<string>();
            Priorities = new ObservableCollection<string> { "Düşük", "Orta", "Yüksek" };
        }

        public EditTaskViewModel() : this(MauiProgram.Services!.GetRequiredService<ApiService>())
        {
        }

        private TaskModel? editingTask;
        public TaskModel? EditingTask
        {
            get => editingTask;
            set
            {
                SetProperty(ref editingTask, value);
                if (value != null)
                {
                    LoadTask(value);
                }
            }
        }

        public async Task LoadTaskById(int id)
        {
            var task = await _apiService.GetTaskById(id);
            if (task != null)
            {
                EditingTask = task;
            }
        }

        private void LoadTask(TaskModel task)
        {
            Title = task.Title;
            Description = task.Description;
            DueDate = task.DueDate?.ToLocalTime() ?? DateTime.Today.AddDays(1);
            SelectedTime = task.DueTime.HasValue
                ? task.DueTime.Value.ToLocalTime().TimeOfDay
                : (TimeSpan?)null;
            EnableTime = task.DueTime.HasValue;
            SelectedPriority = task.Priority switch
            {
                "Low" => "Düşük",
                "Medium" => "Orta",
                "High" => "Yüksek",
                _ => "Orta"
            };
            Tags = task.Tags != null
                ? new ObservableCollection<string>(task.Tags)
                : new ObservableCollection<string>();

            NewTag = Tags.FirstOrDefault();

            TaskId = task.Id;
        }

        [ObservableProperty]
        private string title = string.Empty;

        partial void OnTitleChanged(string value)
        {
            OnPropertyChanged(nameof(IsTitleLimitExceeded));
            OnPropertyChanged(nameof(TitleWarning));
        }

        [ObservableProperty]
        private string description = string.Empty;

        partial void OnDescriptionChanged(string value)
        {
            OnPropertyChanged(nameof(IsDescriptionLimitExceeded));
            OnPropertyChanged(nameof(DescriptionWarning));
        }

        [ObservableProperty]
        private string? newTag;

        partial void OnNewTagChanged(string? value)
        {
            OnPropertyChanged(nameof(IsTagLimitExceeded));
            OnPropertyChanged(nameof(TagWarning));
        }

        [ObservableProperty]
        private DateTime? dueDate = DateTime.Today.AddDays(1);

        [ObservableProperty]
        private bool enableTime;

        [ObservableProperty]
        private TimeSpan? selectedTime;

        [ObservableProperty]
        private string selectedPriority = "Orta";

        [ObservableProperty]
        private ObservableCollection<string> tags = new();

        [ObservableProperty]
        private int taskId;

        public ObservableCollection<string> Priorities { get; } = new();

        public string TagsDisplay => Tags.Any() ? string.Join(", ", Tags) : string.Empty;

        public bool IsTitleLimitExceeded => Title?.Length >= 80;
        public string TitleWarning => IsTitleLimitExceeded ? "En fazla 80 karakter olabilir." : string.Empty;

        public bool IsDescriptionLimitExceeded => Description?.Length >= 300;
        public string DescriptionWarning => IsDescriptionLimitExceeded ? "En fazla 300 karakter olabilir." : string.Empty;

        public bool IsTagLimitExceeded => NewTag?.Length >= 30;
        public string TagWarning => IsTagLimitExceeded ? "En fazla 30 karakter olabilir." : string.Empty;

        [RelayCommand]
        private async Task UpdateTask()
        {
            if (string.IsNullOrWhiteSpace(Title))
            {
                await Shell.Current.DisplayAlert("Uyarı", "Başlık boş olamaz.", "Tamam");
                return;
            }

            if (DueDate == null)
            {
                await Shell.Current.DisplayAlert("Uyarı", "Son tarih seçilmelidir.", "Tamam");
                return;
            }

            if (!string.IsNullOrWhiteSpace(NewTag))
            {
                Tags.Clear();
                Tags.Add(NewTag);
            }

            DateTime? finalDueDate = null;
            DateTime? finalDueTime = null;

            if (DueDate.HasValue)
            {
                var date = DueDate.Value.Date;

                if (EnableTime)
                {
                    var time = SelectedTime ?? TimeSpan.Zero;
                    var localDateTime = DateTime.SpecifyKind(date.Add(time), DateTimeKind.Local);
                    finalDueDate = localDateTime.ToUniversalTime();
                    finalDueTime = localDateTime.ToUniversalTime();
                }
                else
                {
                    var localDateTime = new DateTime(date.Year, date.Month, date.Day, 0, 0, 0, DateTimeKind.Local);
                    finalDueDate = localDateTime.ToUniversalTime();
                }
            }

            string priorityEnum = SelectedPriority switch
            {
                "Düşük" => "Low",
                "Orta" => "Medium",
                "Yüksek" => "High",
                _ => "Medium"
            };

            var updatedTask = new TaskModel
            {
                Id = TaskId,
                Title = Title,
                Description = Description,
                DueDate = finalDueDate,
                DueTime = finalDueTime,
                IsCompleted = EditingTask?.IsCompleted ?? false,
                Tags = Tags.ToList(),
                Priority = priorityEnum
            };

            bool result = await _apiService.UpdateTask(updatedTask);

            if (result)
            {
                WeakReferenceMessenger.Default.Send(new TaskUpdatedMessage());
                await Shell.Current.GoToAsync($"///{RouteNames.HomePage}");
            }
            else
            {
                await Shell.Current.DisplayAlert("Hata", "Görev güncellenemedi.", "Tamam");
            }
        }

    }

    public class TaskUpdatedMessage { }
}