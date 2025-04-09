using System;
using System.Collections.Generic;

namespace Tazq_Frontend.Models
{
    public class TaskModel
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime? DueDate { get; set; }
        public DateTime? DueTime { get; set; }
        public bool IsCompleted { get; set; }
        public string Priority { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new();
        public string TagsJson { get; set; } = string.Empty; // Encrypted Tags

        // Constructor
        public TaskModel()
        {
            Tags = new List<string>();
        }

        public bool IsExpired => DueDate.HasValue && DueDate.Value.Date < DateTime.Today;
        public bool IsToday => DueDate.HasValue && DueDate.Value.Date == DateTime.Today;

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
    }
}