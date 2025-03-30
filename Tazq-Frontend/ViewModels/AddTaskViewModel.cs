using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging.Messages;
using CommunityToolkit.Mvvm.Messaging;
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
            Tags = [];
            Priorities = ["Düşük", "Orta", "Yüksek"];
        }

        // Title
        public string Title
        {
            get => title;
            set => SetProperty(ref title, value);
        }
        private string title = string.Empty;

        // Description
        public string Description
        {
            get => description;
            set => SetProperty(ref description, value);
        }
        private string description = string.Empty;

        // DueDate
        public DateTime? DueDate
        {
            get => dueDate;
            set => SetProperty(ref dueDate, value);
        }
        private DateTime? dueDate = DateTime.Today.AddDays(1);

        // SelectedPriority
        public string SelectedPriority
        {
            get => selectedPriority;
            set => SetProperty(ref selectedPriority, value);
        }
        private string selectedPriority = "Orta";

        // Tags
        public ObservableCollection<string> Tags
        {
            get => tags;
            set => SetProperty(ref tags, value);
        }
        private ObservableCollection<string> tags = [];

        // NewTag
        public string? NewTag
        {
            get => newTag;
            set => SetProperty(ref newTag, value);
        }
        private string? newTag;

        public ObservableCollection<string> Priorities { get; }

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
