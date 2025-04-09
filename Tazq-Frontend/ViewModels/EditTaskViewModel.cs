using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;
using System.Collections.ObjectModel;
using Tazq_Frontend.Models;
using Tazq_Frontend.Services;

namespace Tazq_Frontend.ViewModels
{
    public partial class EditTaskViewModel : ObservableObject
    {
        private readonly ApiService _apiService;

        public EditTaskViewModel()
        {
            _apiService = new ApiService();
            Tags = new ObservableCollection<string>();
            Priorities = new ObservableCollection<string> { "Düşük", "Orta", "Yüksek" };
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
                LoadTask(task);
            }
        }

        private void LoadTask(TaskModel task)
        {
            Title = task.Title;
            Description = task.Description;
            DueDate = task.DueDate?.ToLocalTime() ?? DateTime.Today.AddDays(1);
            SelectedTime = task.DueTime?.ToLocalTime().TimeOfDay ?? TimeSpan.Zero;
            EnableTime = task.DueTime.HasValue;
            SelectedPriority = task.Priority switch
            {
                "Low" => "Düşük",
                "Medium" => "Orta",
                "High" => "Yüksek",
                _ => "Orta"
            };
            Tags = new ObservableCollection<string>(task.Tags ?? new List<string>());
            TaskId = task.Id;
        }

        [ObservableProperty]
        private string title = string.Empty;

        [ObservableProperty]
        private string description = string.Empty;

        [ObservableProperty]
        private string? newTag;

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
        public string TitleWarning => IsTitleLimitExceeded ? "Başlık en fazla 80 karakter olabilir." : string.Empty;

        public bool IsDescriptionLimitExceeded => Description?.Length >= 300;
        public string DescriptionWarning => IsDescriptionLimitExceeded ? "Açıklama en fazla 300 karakter olabilir." : string.Empty;

        public bool IsTagLimitExceeded => NewTag?.Length >= 30;
        public string TagWarning => IsTagLimitExceeded ? "Etiket en fazla 30 karakter olabilir." : string.Empty;

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

            if (!string.IsNullOrWhiteSpace(NewTag) && !Tags.Contains(NewTag))
                Tags.Add(NewTag);

            DateTime? finalDueTime = null;

            if (EnableTime)
            {
                var time = SelectedTime ?? TimeSpan.Zero;
                finalDueTime = new DateTime(
                    DueDate.Value.Year,
                    DueDate.Value.Month,
                    DueDate.Value.Day,
                    time.Hours,
                    time.Minutes,
                    0,
                    DateTimeKind.Local
                ).ToUniversalTime();
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
                DueDate = DueDate?.ToUniversalTime(),
                DueTime = finalDueTime,
                IsCompleted = EditingTask?.IsCompleted ?? false,
                Tags = Tags.ToList(),
                Priority = priorityEnum
            };

            bool result = await _apiService.UpdateTask(updatedTask);

            if (result)
            {
                WeakReferenceMessenger.Default.Send(new TaskUpdatedMessage());
                await Shell.Current.GoToAsync("..");
            }
            else
            {
                await Shell.Current.DisplayAlert("Hata", "Görev güncellenemedi.", "Tamam");
            }
        }
    }

    public class TaskUpdatedMessage { }
}