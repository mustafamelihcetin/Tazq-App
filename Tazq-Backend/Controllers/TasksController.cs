using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Tazq_App.Data;
using Tazq_App.Models;
using System.Text.Json;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
    [Route("api/tasks")]
    [ApiController]
    [Authorize]
    public class TasksController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly CryptoService _cryptoService;

        public TasksController(AppDbContext context, CryptoService cryptoService)
        {
            _context = context;
            _cryptoService = cryptoService;
        }

        private int? GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out int userId))
                return userId;
            return null;
        }

        [HttpGet]
        public async Task<IActionResult> GetTasks(
            [FromQuery] string? tag,
            [FromQuery] string? search,
            [FromQuery] string? sortBy,
            [FromQuery] bool? isCompleted,
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized(new { status = 401, message = "Invalid or missing user ID in token." });

            var query = _context.Tasks.Where(t => t.UserId == userId.Value).AsQueryable();

            if (!string.IsNullOrEmpty(tag))
                query = query.Where(t => t.Tags.Contains(tag));

            if (isCompleted.HasValue)
                query = query.Where(t => t.IsCompleted == isCompleted.Value);

            if (startDate.HasValue)
                query = query.Where(t => t.DueDate >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(t => t.DueDate <= endDate.Value);

            var taskList = await query.ToListAsync();

            var key = _cryptoService.GetKeyForUser(userId.Value)!;
            foreach (var task in taskList)
            {
                task.Title = _cryptoService.Decrypt(task.Title, key);
                task.Description = string.IsNullOrEmpty(task.Description) ? null : _cryptoService.Decrypt(task.Description, key);
            }

            if (!string.IsNullOrEmpty(search))
            {
                taskList = taskList.Where(t =>
                    (!string.IsNullOrEmpty(t.Title) && t.Title.Contains(search, StringComparison.OrdinalIgnoreCase)) ||
                    (!string.IsNullOrEmpty(t.Description) && t.Description.Contains(search, StringComparison.OrdinalIgnoreCase))
                ).ToList();
            }

            taskList = sortBy?.ToLower() switch
            {
                "duedate" => taskList.OrderBy(t => t.DueDate).ToList(),
                "priority" => taskList.OrderByDescending(t => t.Priority).ToList(),
                "title" => taskList.OrderBy(t => t.Title).ToList(),
                _ => taskList
            };

            return Ok(taskList);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetTaskById(int id)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized("User ID not found in token.");

            var task = await _context.Tasks.FindAsync(id);

            if (task == null)
                return NotFound();

            if (task.UserId != userId)
                return Forbid("You are not allowed to access this task.");

            var key = _cryptoService.GetKeyForUser(userId.Value)!;
            task.Title = _cryptoService.Decrypt(task.Title, key);
            task.Description = string.IsNullOrEmpty(task.Description) ? null : _cryptoService.Decrypt(task.Description, key);

            return Ok(task);
        }

        [HttpPost]
        public async Task<IActionResult> CreateTask([FromBody] TaskItem task)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized("User ID not found in token.");

            try
            {
                task.UserId = userId.Value;
                task.Tags = task.Tags ?? new List<string>();
                task.TagsJson = JsonSerializer.Serialize(task.Tags);

                var key = _cryptoService.GetKeyForUser(userId.Value)!;
                task.Title = _cryptoService.Encrypt(task.Title, key);
                task.Description = string.IsNullOrEmpty(task.Description) ? null : _cryptoService.Encrypt(task.Description, key);

                if (task.DueTime.HasValue)
                    task.DueTime = task.DueTime.Value.ToUniversalTime();

                _context.Tasks.Add(task);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetTaskById), new { id = task.Id }, task);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    StatusCode = 500,
                    Message = ex.Message,
                    Inner = ex.InnerException?.Message,
                    StackTrace = ex.StackTrace
                });
            }
        }

        [HttpPost("bulk")]
        public async Task<IActionResult> CreateTasks([FromBody] TaskRequestDto taskRequest)
        {
            if (taskRequest?.Tasks == null || !taskRequest.Tasks.Any())
                return BadRequest(new { message = "Invalid request body. 'tasks' array cannot be empty." });

            var userId = GetUserId();
            if (userId == null)
                return Unauthorized("User ID not found in token.");

            var key = _cryptoService.GetKeyForUser(userId.Value)!;

            var taskItems = taskRequest.Tasks.Select(t => new TaskItem
            {
                Title = _cryptoService.Encrypt(t.Title, key),
                Description = string.IsNullOrEmpty(t.Description) ? null : _cryptoService.Encrypt(t.Description, key),
                DueDate = t.DueDate,
                DueTime = t.GetType().GetProperty("DueTime")?.GetValue(t) as DateTime? ?? null,
                IsCompleted = t.IsCompleted,
                Priority = t.Priority,
                UserId = userId.Value,
                Tags = t.Tags ?? new List<string>(),
                TagsJson = JsonSerializer.Serialize(t.Tags ?? new List<string>())
            }).ToList();

            await _context.Tasks.AddRangeAsync(taskItems);
            await _context.SaveChangesAsync();

            return Ok(new { message = $"{taskItems.Count} tasks created successfully." });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTask(int id, [FromBody] TaskItem updatedTask)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized("User ID not found in token.");

            var task = await _context.Tasks.FindAsync(id);
            if (task == null)
                return NotFound("Task not found.");

            if (task.UserId != userId)
                return Forbid("You are not allowed to update this task.");

            var key = _cryptoService.GetKeyForUser(userId.Value)!;

            task.Title = _cryptoService.Encrypt(updatedTask.Title, key);
            task.Description = string.IsNullOrEmpty(updatedTask.Description) ? null : _cryptoService.Encrypt(updatedTask.Description, key);
            task.DueDate = updatedTask.DueDate;
            task.DueTime = updatedTask.DueTime?.ToUniversalTime();
            task.IsCompleted = updatedTask.IsCompleted;
            task.Priority = updatedTask.Priority;
            task.Tags = updatedTask.Tags ?? new List<string>();
            task.TagsJson = JsonSerializer.Serialize(task.Tags);

            _context.Tasks.Update(task);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Task updated successfully.", task });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized("User ID not found in token.");

            var task = await _context.Tasks.FindAsync(id);
            if (task == null)
                return NotFound("Task not found.");

            if (task.UserId != userId)
                return Forbid("You are not allowed to delete this task.");

            _context.Tasks.Remove(task);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}