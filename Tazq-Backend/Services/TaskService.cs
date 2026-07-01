using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    public class TaskService : ITaskService
    {
        private readonly AppDbContext _context;
        private readonly ICryptoService _cryptoService;
        private readonly ILogger<TaskService> _logger;

        public TaskService(AppDbContext context, ICryptoService cryptoService, ILogger<TaskService> logger)
        {
            _context = context;
            _cryptoService = cryptoService;
            _logger = logger;
        }

        public async Task<(List<TaskItem> Items, int TotalCount)> GetTasksAsync(int userId, string? tag, string? search, string? sortBy, bool? isCompleted, DateTime? startDate, DateTime? endDate, int page = 1, int pageSize = 50)
        {
            var query = _context.Tasks.AsNoTracking().Where(t => t.UserId == userId).AsQueryable();
            var key = _cryptoService.GetKeyForUser(userId)!;

            // Apply filters that can be done at DB level
            if (isCompleted.HasValue)
                query = query.Where(t => t.IsCompleted == isCompleted.Value);

            if (startDate.HasValue)
                query = query.Where(t => t.DueDate >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(t => t.DueDate <= endDate.Value);

            // 1. Tag Filtering using Blind Index
            if (!string.IsNullOrEmpty(tag))
            {
                var tagHash = _cryptoService.ComputeBlindIndex(tag, key);
                if (!string.IsNullOrEmpty(tagHash))
                {
                    query = query.Where(t => t.TagsBlindIndex != null && t.TagsBlindIndex.Contains(tagHash));
                }
            }

            // 2. Search Filtering using Blind Index
            if (!string.IsNullOrEmpty(search))
            {
                var searchWords = System.Text.RegularExpressions.Regex.Split(search.ToLowerInvariant(), @"[^\p{L}\p{N}]+")
                    .Where(w => !string.IsNullOrWhiteSpace(w))
                    .Distinct()
                    .ToList();

                if (searchWords.Count > 0)
                {
                    using var hmac = new System.Security.Cryptography.HMACSHA256(key);
                    foreach (var word in searchWords)
                    {
                        byte[] wordHashBytes = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(word));
                        string wordHash = Convert.ToBase64String(wordHashBytes);
                        
                        query = query.Where(t => t.TitleBlindIndex != null && t.TitleBlindIndex.Contains(wordHash));
                    }
                }
            }

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


        public async Task<TaskItem?> GetTaskByIdAsync(int userId, int taskId)
        {
            var task = await _context.Tasks.AsNoTracking().FirstOrDefaultAsync(t => t.Id == taskId);
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
            // Idempotency: ağ kopması/timeout sonrası istemci aynı görevi tekrar
            // gönderebilir. Aynı kullanıcıda tamamlanmamış aynı ClientKey'li görev
            // varsa yenisini oluşturmadan mevcudu döndür (at-least-once → exactly-once).
            if (!string.IsNullOrEmpty(task.ClientKey))
            {
                var existing = await _context.Tasks
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.UserId == userId
                        && t.ClientKey == task.ClientKey
                        && !t.IsCompleted);
                if (existing != null)
                {
                    var existingKey = _cryptoService.GetKeyForUser(userId)!;
                    DecryptTask(existing, existingKey);
                    return existing;
                }
            }

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

        public async Task<bool> ReorderTasksAsync(int userId, List<int> orderedIds)
        {
            if (orderedIds == null || orderedIds.Count == 0) return false;

            var tasks = await _context.Tasks
                .Where(t => t.UserId == userId && orderedIds.Contains(t.Id))
                .ToListAsync();

            if (tasks.Count == 0) return false;

            var taskMap = tasks.ToDictionary(t => t.Id);

            for (int i = 0; i < orderedIds.Count; i++)
            {
                var id = orderedIds[i];
                if (taskMap.TryGetValue(id, out var task))
                {
                    task.SortOrder = i;
                }
            }

            await _context.SaveChangesAsync();
            return true;
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
            // Compute blind indexes using plaintext before encryption
            task.TitleBlindIndex = _cryptoService.ComputeBlindIndex(task.Title, key);
            var tagsText = string.Join(" ", task.Tags ?? new List<string>());
            task.TagsBlindIndex = _cryptoService.ComputeBlindIndex(tagsText, key);

            task.Title = _cryptoService.Encrypt(task.Title, key);
            task.Description = _cryptoService.Encrypt(task.Description ?? string.Empty, key);
            var jsonTags = JsonSerializer.Serialize(task.Tags ?? new List<string>());
            task.TagsJson = _cryptoService.Encrypt(jsonTags, key);
            var jsonSubtasks = JsonSerializer.Serialize(task.Subtasks ?? new List<SubtaskItem>());
            task.SubtasksJson = _cryptoService.Encrypt(jsonSubtasks, key);
        }

        // Bir alanın şifresini güvenle çözer: hata olursa TÜM isteği düşürmek yerine
        // o alanı atlar, anlamlı bir uyarı loglar (task id + alan + sebep) ve null döner.
        // Böylece tek bir bozuk satır (ör. eski/hasarlı şifreli veri) bütün görev
        // listesini 500'e düşürmez — kalan görevler normal yüklenir.
        private string? SafeDecrypt(string? cipher, byte[] key, int taskId, string field)
        {
            if (string.IsNullOrEmpty(cipher)) return string.Empty;

            // Geriye dönük uyumluluk: Eğer veri zaten şifrelenmemiş düz metin/JSON ise (örn: '[]' veya düz metin),
            // şifre çözmeyi atlayıp doğrudan verinin kendisini dönelim.
            if ((cipher.StartsWith('[') && cipher.EndsWith(']')) || !IsBase64String(cipher))
            {
                return cipher;
            }

            try
            {
                return _cryptoService.Decrypt(cipher, key);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Decrypt failed for Task {TaskId} field {Field}: {Error}", taskId, field, ex.Message);
                return null;
            }
        }

        private bool IsBase64String(string s)
        {
            if (string.IsNullOrEmpty(s) || s.Length % 4 != 0 || s.Contains(' ') || s.Contains('\t') || s.Contains('\r') || s.Contains('\n'))
                return false;
            try
            {
                Convert.FromBase64String(s);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private void DecryptTask(TaskItem task, byte[] key)
        {
            // Title çözülemezse görev yine listede görünsün (silinmesin) — yer-tutucu başlık.
            task.Title = SafeDecrypt(task.Title, key, task.Id, "Title") ?? "⚠️ (çözülemeyen başlık)";
            task.Description = SafeDecrypt(task.Description, key, task.Id, "Description") ?? string.Empty;

            var decryptedTags = SafeDecrypt(task.TagsJson, key, task.Id, "Tags");
            task.Tags = TryDeserialize<List<string>>(decryptedTags) ?? new List<string>();

            var decryptedSubs = SafeDecrypt(task.SubtasksJson, key, task.Id, "Subtasks");
            task.Subtasks = TryDeserialize<List<SubtaskItem>>(decryptedSubs) ?? new List<SubtaskItem>();
        }

        private T? TryDeserialize<T>(string? json) where T : class
        {
            if (string.IsNullOrEmpty(json)) return null;
            try { return JsonSerializer.Deserialize<T>(json); }
            catch (Exception ex) { _logger.LogWarning("JSON parse failed: {Error}", ex.Message); return null; }
        }
    }
}
