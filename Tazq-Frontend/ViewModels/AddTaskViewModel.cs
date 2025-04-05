using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;
using CommunityToolkit.Mvvm.Messaging.Messages;
using Tazq_Frontend.Models;
using Tazq_Frontend.Services;

namespace Tazq_Frontend.ViewModels
{
    public partial class AddTaskViewModel : ObservableObject
    {
        private readonly ApiService _apiService;

        public AddTaskViewModel()
        {
            _apiService = new ApiService();
            Tags = new ObservableCollection<string>();
            Priorities = new ObservableCollection<string> { "Düşük", "Orta", "Yüksek" };
            EnableTime = false;
            SelectedTime = null;
        }

        public string Title
        {
            get => title;
            set => SetProperty(ref title, value);
        }
        private string title = string.Empty;

        public string Description
        {
            get => description;
            set => SetProperty(ref description, value);
        }
        private string description = string.Empty;

        public DateTime? DueDate
        {
            get => dueDate;
            set => SetProperty(ref dueDate, value);
        }
        private DateTime? dueDate = DateTime.Today.AddDays(1);

        public bool EnableTime
        {
            get => enableTime;
            set => SetProperty(ref enableTime, value);
        }
        private bool enableTime;

        public TimeSpan? SelectedTime
        {
            get => selectedTime;
            set => SetProperty(ref selectedTime, value);
        }
        private TimeSpan? selectedTime;

        public string SelectedPriority
        {
            get => selectedPriority;
            set => SetProperty(ref selectedPriority, value);
        }
        private string selectedPriority = "Orta";

        public ObservableCollection<string> Tags
        {
            get => tags;
            set => SetProperty(ref tags, value);
        }
        private ObservableCollection<string> tags = new();

        public string? NewTag
        {
            get => newTag;
            set => SetProperty(ref newTag, value);
        }
        private string? newTag;

        public ObservableCollection<string> Priorities { get; } = new();

        public string TagsDisplay => Tags.Any() ? string.Join(", ", Tags) : string.Empty;

        [RelayCommand]
        private async Task SaveTask()
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
                var time = SelectedTime ?? TimeSpan.Zero; // varsayılan 00:00:00
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

            var newTask = new TaskModel
            {
                Title = Title,
                Description = Description,
                DueDate = DueDate?.ToUniversalTime(),
                DueTime = finalDueTime,
                IsCompleted = false,
                Tags = Tags.ToList(),
                Priority = priorityEnum
            };

            bool result = await _apiService.AddTask(newTask);

            if (result)
            {
                WeakReferenceMessenger.Default.Send(new TaskAddedMessage());
                await Shell.Current.GoToAsync("..");
            }
            else
            {
                await Shell.Current.DisplayAlert("Hata", "Görev kaydedilemedi.", "Tamam");
            }
        }
    }

    public class TaskAddedMessage : ValueChangedMessage<bool>
    {
        public TaskAddedMessage() : base(true) { }
    }
}