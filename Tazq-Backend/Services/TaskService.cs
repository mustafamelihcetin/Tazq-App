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

        public async Task<(List<TaskItem> Items, int TotalCount)> GetTasksAsync(int userId, string? tag, string? search, string? sortBy, bool? isCompleted, DateTime? startDate, DateTime? endDate, int page = 1, int pageSize = 50)
        {
            var query = _context.Tasks.Where(t => t.UserId == userId).AsQueryable();
            var key = _cryptoService.GetKeyForUser(userId)!;

            // Apply filters that can be done at DB level
            if (isCompleted.HasValue)
                query = query.Where(t => t.IsCompleted == isCompleted.Value);

            if (startDate.HasValue)
                query = query.Where(t => t.DueDate >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(t => t.DueDate <= endDate.Value);

            // If we have a search or tag filter, we must pull and decrypt (or implement blind indexing)
            // For now, let's optimize the non-search path which is 90% of usage
            if (string.IsNullOrEmpty(search) && string.IsNullOrEmpty(tag))
            {
                var totalCount = await query.CountAsync();
                
                // Sort at DB level on non-encrypted fields
                query = sortBy?.ToLower() switch
                {
                    "duedate" => query.OrderBy(t => t.DueDate),
                    "priority" => query.OrderByDescending(t => t.Priority),
                    _ => query.OrderByDescending(t => t.SortOrder)
                };

                var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
                foreach (var item in items) DecryptTask(item, key);
                
                return (items, totalCount);
            }
            else
            {
                // Fallback for search/tag (requires decryption in memory for now)
                var allTasks = await query.ToListAsync();
                foreach (var task in allTasks) DecryptTask(task, key);

                var filtered = allTasks.AsEnumerable();

                if (!string.IsNullOrEmpty(tag))
                {
                    filtered = filtered.Where(t => t.Tags != null && t.Tags.Any(tg => tg.Equals(tag, StringComparison.OrdinalIgnoreCase)));
                }

                if (!string.IsNullOrEmpty(search))
                {
                    filtered = filtered.Where(t =>
                        (!string.IsNullOrEmpty(t.Title) && t.Title.Contains(search, StringComparison.OrdinalIgnoreCase)) ||
                        (!string.IsNullOrEmpty(t.Description) && t.Description.Contains(search, StringComparison.OrdinalIgnoreCase))
                    );
                }

                // Final sorting and pagination in memory
                var sorted = sortBy?.ToLower() switch
                {
                    "duedate" => filtered.OrderBy(t => t.DueDate),
                    "priority" => filtered.OrderByDescending(t => t.Priority),
                    "title" => filtered.OrderBy(t => t.Title),
                    _ => filtered.OrderByDescending(t => t.SortOrder)
                };

                var sortedList = sorted.ToList();
                var finalCount = sortedList.Count;
                var result = sortedList.Skip((page - 1) * pageSize).Take(pageSize).ToList();

                return (result, finalCount);
            }
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

        private const int MaxTasksPerUser = 200;
        private const int MaxSubtasksPerTask = 15;
        private const int MaxTagsPerTask = 8;

        public async Task<TaskItem> CreateTaskAsync(int userId, TaskItem task)
        {
            var taskCount = await _context.Tasks.CountAsync(t => t.UserId == userId);
            if (taskCount >= MaxTasksPerUser)
                throw new InvalidOperationException($"TASK_LIMIT_REACHED:{MaxTasksPerUser}");

            task.UserId = userId;
            task.Tags = (task.Tags ?? new List<string>()).Take(MaxTagsPerTask).ToList();
            task.Subtasks = (task.Subtasks ?? new List<SubtaskItem>()).Take(MaxSubtasksPerTask).ToList();

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
            var taskCount = await _context.Tasks.CountAsync(t => t.UserId == userId);
            var allowed = MaxTasksPerUser - taskCount;
            if (allowed <= 0)
                return false;
            tasks = tasks.Take(allowed).ToList();

            var key = _cryptoService.GetKeyForUser(userId)!;

            foreach (var t in tasks)
            {
                t.UserId = userId;
                t.Tags = (t.Tags ?? new List<string>()).Take(MaxTagsPerTask).ToList();
                t.Subtasks = (t.Subtasks ?? new List<SubtaskItem>()).Take(MaxSubtasksPerTask).ToList();
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
            task.Tags = (updatedTask.Tags ?? new List<string>()).Take(MaxTagsPerTask).ToList();
            task.Subtasks = (updatedTask.Subtasks ?? new List<SubtaskItem>()).Take(MaxSubtasksPerTask).ToList();
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
