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
        public bool IsCompleted { get; set; }
        public string Priority { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new();

        public bool IsExpired => DueDate.HasValue && DueDate.Value.Date < DateTime.Today;
        public bool IsToday => DueDate.HasValue && DueDate.Value.Date == DateTime.Today;
        public string PriorityLevel => Priority;
    }
}
