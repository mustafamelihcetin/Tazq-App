using System;
using System.Collections.Generic;
using CommunityToolkit.Mvvm.ComponentModel;

namespace Tazq_Frontend.Models
{
    public partial class TaskModel : ObservableObject
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime? DueDate { get; set; }
        public DateTime? DueTime { get; set; }
        public bool IsCompleted { get; set; }
        public string Priority { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new();
        public string TagsJson { get; set; } = string.Empty; // Encrypted Tags

        [ObservableProperty]
        private bool isExpanded = false;

        [ObservableProperty]
        private bool isTitleExpanded = false;

        [ObservableProperty]
        private bool isDescriptionExpanded = false;

        public bool IsTodayAndIncomplete => IsToday && !IsCompleted;

        // Constructor
        public TaskModel()
        {
            Tags = new List<string>();
        }

        public bool IsDueTodayAndNotCompleted => IsToday && !IsCompleted;

        public bool IsExpired => DueDate.HasValue && DueDate.Value.Date < DateTime.Today;
        public bool IsToday => DueDate.HasValue && DueDate.Value.Date == DateTime.Today;

        public bool HasDueDate => DueDate.HasValue;

        // Converts string "0", "1", "2" or "Low", "Medium", "High" to enum
        public TaskPriority PriorityEnum
        {
            get
            {
                if (int.TryParse(Priority, out int intPriority) && Enum.IsDefined(typeof(TaskPriority), intPriority))
                    return (TaskPriority)intPriority;

                if (Enum.TryParse<TaskPriority>(Priority, true, out var parsed))
                    return parsed;

                return TaskPriority.Low; // default fallback
            }
        }

        public string PriorityLevel => PriorityEnum.ToString();

        // Combined DueDate and DueTime
        public DateTime? DueDateTimeCombined =>
            DueDate.HasValue && DueTime.HasValue
                ? DateTime.SpecifyKind(
                    new DateTime(
                        DueDate.Value.Year,
                        DueDate.Value.Month,
                        DueDate.Value.Day,
                        DueTime.Value.Hour,
                        DueTime.Value.Minute,
                        0),
                    DateTimeKind.Utc).ToLocalTime()
                : DueDate?.ToLocalTime();

        [ObservableProperty]
        private bool animateDueDate = false;
    }
}
