using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Tazq_App.Data;
using Tazq_App.Models;
using System.Text.Json;

namespace Tazq_App.Controllers
{
	[Route("api/tasks")]
	[ApiController]
	[Authorize]
	public class TasksController : ControllerBase
	{
		private readonly AppDbContext _context;

		public TasksController(AppDbContext context)
		{
			_context = context;
		}

		// Get tasks with filtering and sorting
		[HttpGet]
		public async Task<IActionResult> GetTasks(
			[FromQuery] string? tag,
			[FromQuery] string? search,
			[FromQuery] string? sortBy,
			[FromQuery] bool? isCompleted,
			[FromQuery] DateTime? startDate,
			[FromQuery] DateTime? endDate)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

			if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
				return Unauthorized(new { status = 401, message = "Invalid or missing user ID in token." });

			bool isAdmin = User.IsInRole("Admin");

			var query = _context.Tasks.AsQueryable();

			if (!isAdmin)
				query = query.Where(t => t.UserId == userId);

			if (!string.IsNullOrEmpty(tag))
				query = query.Where(t => t.Tags.Contains(tag));

			if (!string.IsNullOrEmpty(search))
				query = query.Where(t => t.Title.Contains(search) || t.Description.Contains(search));

			if (isCompleted.HasValue)
				query = query.Where(t => t.IsCompleted == isCompleted.Value);

			if (startDate.HasValue)
				query = query.Where(t => t.DueDate >= startDate.Value);

			if (endDate.HasValue)
				query = query.Where(t => t.DueDate <= endDate.Value);

			query = sortBy?.ToLower() switch
			{
				"duedate" => query.OrderBy(t => t.DueDate),
				"priority" => query.OrderByDescending(t => t.Priority),
				"title" => query.OrderBy(t => t.Title),
				_ => query
			};

			var tasks = await query.ToListAsync();
			return Ok(tasks);
		}

		// Get a specific task by ID
		[HttpGet("{id}")]
		public async Task<IActionResult> GetTaskById(int id)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			if (!int.TryParse(userIdClaim, out int userId))
				return Unauthorized(new { status = 401, message = "Invalid user ID in token." });
			bool isAdmin = User.IsInRole("Admin");

			var task = await _context.Tasks.FindAsync(id);

			if (task == null)
				return NotFound();

			if (!isAdmin && task.UserId != userId)
				return Forbid("You are not allowed to access this task.");

			return Ok(task);
		}

		// Create a new task (updated to use TaskItem)
		[HttpPost]
		public async Task<IActionResult> CreateTask([FromBody] TaskItem task)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			if (!int.TryParse(userIdClaim, out int userId))
				return Unauthorized(new { status = 401, message = "Invalid user ID in token." });

			try
			{
				task.UserId = userId;
				task.Tags = task.Tags ?? new List<string>();
				task.TagsJson = JsonSerializer.Serialize(task.Tags);

				_context.Tasks.Add(task);
				await _context.SaveChangesAsync();

				return CreatedAtAction(nameof(GetTaskById), new { id = task.Id }, task);
			}
			catch (Exception ex)
			{
				// Explicit error log
				return StatusCode(500, new
				{
					StatusCode = 500,
					Message = ex.Message,
					Inner = ex.InnerException?.Message,
					StackTrace = ex.StackTrace
				});
			}
		}

		// Bulk create tasks
		[HttpPost("bulk")]
		public async Task<IActionResult> CreateTasks([FromBody] TaskRequestDto taskRequest)
		{
			if (taskRequest == null || taskRequest.Tasks == null || !taskRequest.Tasks.Any())
			{
				return BadRequest(new { message = "Invalid request body. 'tasks' array cannot be empty." });
			}

			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			if (!int.TryParse(userIdClaim, out int userId))
				return Unauthorized(new { status = 401, message = "Invalid user ID in token." });

			var taskItems = taskRequest.Tasks.Select(t => new TaskItem
			{
				Title = t.Title,
				Description = t.Description,
				DueDate = t.DueDate,
				IsCompleted = t.IsCompleted,
				Priority = t.Priority,
				UserId = userId,
				TagsJson = t.Tags != null ? JsonSerializer.Serialize(t.Tags) : "[]"
			}).ToList();

			await _context.Tasks.AddRangeAsync(taskItems);
			await _context.SaveChangesAsync();

			return Ok(new { message = $"{taskItems.Count} tasks created successfully." });
		}

		// Update a task (updated to use TaskItem)
		[HttpPut("{id}")]
		public async Task<IActionResult> UpdateTask(int id, [FromBody] TaskItem updatedTask)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			if (!int.TryParse(userIdClaim, out int userId))
				return Unauthorized(new { status = 401, message = "Invalid user ID in token." });
			bool isAdmin = User.IsInRole("Admin");

			var task = await _context.Tasks.FindAsync(id);
			if (task == null)
				return NotFound("Task not found.");

			if (!isAdmin && task.UserId != userId)
				return Forbid("You are not allowed to update this task.");

			task.Title = updatedTask.Title;
			task.Description = updatedTask.Description;
			task.DueDate = updatedTask.DueDate;
			task.IsCompleted = updatedTask.IsCompleted;
			task.Priority = updatedTask.Priority;
			task.Tags = updatedTask.Tags;

			_context.Tasks.Update(task);
			await _context.SaveChangesAsync();

			return Ok(new { message = "Task updated successfully.", task });
		}

		// Delete a task
		[HttpDelete("{id}")]
		public async Task<IActionResult> DeleteTask(int id)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			if (!int.TryParse(userIdClaim, out int userId))
				return Unauthorized(new { status = 401, message = "Invalid user ID in token." });
			bool isAdmin = User.IsInRole("Admin");

			var task = await _context.Tasks.FindAsync(id);
			if (task == null)
				return NotFound("Task not found.");

			if (!isAdmin && task.UserId != userId)
				return Forbid("You are not allowed to delete this task.");

			_context.Tasks.Remove(task);
			await _context.SaveChangesAsync();

			return NoContent();
		}
	}
}