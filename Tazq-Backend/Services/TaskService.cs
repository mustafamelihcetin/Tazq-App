using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    public class TaskService : ITaskService
    {
        private readonly AppDbContext _context;
        private readonly ICryptoService _cryptoService;

        public TaskService(AppDbContext context, ICryptoService cryptoService)
        {
            _context = context;
            _cryptoService = cryptoService;
        }

        public async Task<List<TaskItem>> GetTasksAsync(int userId, string? tag, string? search, string? sortBy, bool? isCompleted, DateTime? startDate, DateTime? endDate)
        {
            var query = _context.Tasks.Where(t => t.UserId == userId).AsQueryable();
            var key = _cryptoService.GetKeyForUser(userId)!;

            if (!string.IsNullOrEmpty(tag))
            {
                var encryptedTag = _cryptoService.Encrypt(tag, key);
                query = query.Where(t => t.TagsJson.Contains(encryptedTag));
            }

            if (isCompleted.HasValue)
                query = query.Where(t => t.IsCompleted == isCompleted.Value);

            if (startDate.HasValue)
                query = query.Where(t => t.DueDate >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(t => t.DueDate <= endDate.Value);

            var taskList = await query.ToListAsync();

            foreach (var task in taskList)
            {
                DecryptTask(task, key);
            }

            if (!string.IsNullOrEmpty(search))
            {
                taskList = taskList.Where(t =>
                    (!string.IsNullOrEmpty(t.Title) && t.Title.Contains(search, StringComparison.OrdinalIgnoreCase)) ||
                    (!string.IsNullOrEmpty(t.Description) && t.Description.Contains(search, StringComparison.OrdinalIgnoreCase))
                ).ToList();
            }

            return sortBy?.ToLower() switch
            {
                "duedate" => taskList.OrderBy(t => t.DueDate).ToList(),
                "priority" => taskList.OrderByDescending(t => t.Priority).ToList(),
                "title" => taskList.OrderBy(t => t.Title).ToList(),
                _ => taskList
            };
        }

        public async Task<TaskItem?> GetTaskByIdAsync(int userId, int taskId)
        {
            var task = await _context.Tasks.FindAsync(taskId);
            if (task == null || task.UserId != userId)
                return null;

            var key = _cryptoService.GetKeyForUser(userId)!;
            DecryptTask(task, key);
            return task;
        }

        public async Task<TaskItem> CreateTaskAsync(int userId, TaskItem task)
        {
            task.UserId = userId;
            task.Tags = task.Tags ?? new List<string>();

            // Ensure UTC for Postgres timestamptz compatibility
            if (task.DueDate.HasValue && task.DueDate.Value.Kind == DateTimeKind.Unspecified)
                task.DueDate = DateTime.SpecifyKind(task.DueDate.Value, DateTimeKind.Utc);
            if (task.DueTime.HasValue && task.DueTime.Value.Kind == DateTimeKind.Unspecified)
                task.DueTime = DateTime.SpecifyKind(task.DueTime.Value, DateTimeKind.Utc);

            var key = _cryptoService.GetKeyForUser(userId)!;
            EncryptTask(task, key);

            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();

            // Decrypt for returning to client
            DecryptTask(task, key);
            return task;
        }

        public async Task<bool> CreateTasksBulkAsync(int userId, List<TaskItem> tasks)
        {
            var key = _cryptoService.GetKeyForUser(userId)!;

            foreach (var t in tasks)
            {
                t.UserId = userId;
                t.Tags = t.Tags ?? new List<string>();
                EncryptTask(t, key);
            }

            await _context.Tasks.AddRangeAsync(tasks);
            return await _context.SaveChangesAsync() > 0;
        }

        public async Task<TaskItem?> UpdateTaskAsync(int userId, int taskId, TaskItem updatedTask)
        {
            var task = await _context.Tasks.FindAsync(taskId);
            if (task == null || task.UserId != userId)
                return null;

            var key = _cryptoService.GetKeyForUser(userId)!;

            var wasCompleted = task.IsCompleted;

            task.Title = updatedTask.Title;
            task.Description = updatedTask.Description;
            
            // Ensure UTC for Postgres timestamptz compatibility
            var finalDueDate = updatedTask.DueDate;
            if (finalDueDate.HasValue && finalDueDate.Value.Kind == DateTimeKind.Unspecified)
                finalDueDate = DateTime.SpecifyKind(finalDueDate.Value, DateTimeKind.Utc);
            
            var finalDueTime = updatedTask.DueTime;
            if (finalDueTime.HasValue && finalDueTime.Value.Kind == DateTimeKind.Unspecified)
                finalDueTime = DateTime.SpecifyKind(finalDueTime.Value, DateTimeKind.Utc);

            task.DueDate = finalDueDate;
            task.DueTime = finalDueTime;
            task.IsCompleted = updatedTask.IsCompleted;
            task.Priority = updatedTask.Priority;
            task.Tags = updatedTask.Tags ?? new List<string>();
            task.Subtasks = updatedTask.Subtasks ?? new List<SubtaskItem>();
            task.Recurrence = updatedTask.Recurrence;
            task.SortOrder = updatedTask.SortOrder;

            EncryptTask(task, key);

            _context.Tasks.Update(task);
            await _context.SaveChangesAsync();

            // Auto-create next recurring task when completed
            if (!wasCompleted && task.IsCompleted && task.Recurrence != RecurrenceType.None)
            {
                DecryptTask(task, key);
                await CreateNextRecurrence(userId, task, key);
            }

            DecryptTask(task, key);
            return task;
        }

        public async Task<bool> DeleteTaskAsync(int userId, int taskId)
        {
            var task = await _context.Tasks.FindAsync(taskId);
            if (task == null || task.UserId != userId)
                return false;

            _context.Tasks.Remove(task);
            return await _context.SaveChangesAsync() > 0;
        }

        private async System.Threading.Tasks.Task CreateNextRecurrence(int userId, TaskItem source, byte[] key)
        {
            var nextDate = source.Recurrence switch
            {
                RecurrenceType.Daily => source.DueDate?.AddDays(1),
                RecurrenceType.Weekly => source.DueDate?.AddDays(7),
                RecurrenceType.Monthly => source.DueDate?.AddMonths(1),
                _ => null
            };

            if (nextDate == null) return;

            var newTask = new TaskItem
            {
                Title = source.Title,
                Description = source.Description,
                DueDate = nextDate.Value.Kind == DateTimeKind.Unspecified
                    ? DateTime.SpecifyKind(nextDate.Value, DateTimeKind.Utc) : nextDate,
                DueTime = source.DueTime,
                IsCompleted = false,
                Priority = source.Priority,
                Tags = source.Tags ?? new List<string>(),
                Subtasks = (source.Subtasks ?? new List<SubtaskItem>())
                    .Select(s => new SubtaskItem { Text = s.Text, Done = false }).ToList(),
                Recurrence = source.Recurrence,
                SortOrder = source.SortOrder,
                UserId = userId
            };

            EncryptTask(newTask, key);
            _context.Tasks.Add(newTask);
            await _context.SaveChangesAsync();
        }

        private void EncryptTask(TaskItem task, byte[] key)
        {
            task.Title = _cryptoService.Encrypt(task.Title, key);
            task.Description = _cryptoService.Encrypt(task.Description ?? string.Empty, key);
            var jsonTags = JsonSerializer.Serialize(task.Tags ?? new List<string>());
            task.TagsJson = _cryptoService.Encrypt(jsonTags, key);
            var jsonSubtasks = JsonSerializer.Serialize(task.Subtasks ?? new List<SubtaskItem>());
            task.SubtasksJson = _cryptoService.Encrypt(jsonSubtasks, key);
        }

        private void DecryptTask(TaskItem task, byte[] key)
        {
            task.Title = _cryptoService.Decrypt(task.Title, key);
            task.Description = _cryptoService.Decrypt(task.Description ?? string.Empty, key);
            if (!string.IsNullOrEmpty(task.TagsJson))
            {
                var decryptedJson = _cryptoService.Decrypt(task.TagsJson, key);
                task.Tags = JsonSerializer.Deserialize<List<string>>(decryptedJson) ?? new List<string>();
            }
            if (!string.IsNullOrEmpty(task.SubtasksJson))
            {
                var decryptedSubs = _cryptoService.Decrypt(task.SubtasksJson, key);
                task.Subtasks = JsonSerializer.Deserialize<List<SubtaskItem>>(decryptedSubs) ?? new List<SubtaskItem>();
            }
        }
    }
}
