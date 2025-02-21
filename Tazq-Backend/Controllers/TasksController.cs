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
			if (userIdClaim == null)
				return Unauthorized(new { status = 401, message = "User authentication failed. Please provide a valid token." });

			int userId = int.Parse(userIdClaim);
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

			int userId = int.Parse(userIdClaim);
			bool isAdmin = User.IsInRole("Admin");

			var task = await _context.Tasks.FindAsync(id);

			if (task == null)
				return NotFound();

			if (!isAdmin && task.UserId != userId)
				return Forbid("You are not allowed to access this task.");

			return Ok(task);
		}

		// Create a new task
		[HttpPost]
		public async Task<IActionResult> CreateTask([FromBody] TaskDto taskDto)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			int userId = int.Parse(userIdClaim);

			var task = new TaskItem
			{
				Title = taskDto.Title,
				Description = taskDto.Description,
				DueDate = taskDto.DueDate,
				IsCompleted = taskDto.IsCompleted,
				Priority = taskDto.Priority,
				UserId = userId,
				Tags = taskDto.Tags
			};

			_context.Tasks.Add(task);
			await _context.SaveChangesAsync();
			return CreatedAtAction(nameof(GetTaskById), new { id = task.Id }, task);
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

			int userId = int.Parse(userIdClaim);

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

		// Update a task
		[HttpPut("{id}")]
		public async Task<IActionResult> UpdateTask(int id, [FromBody] TaskDto taskDto)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			int userId = int.Parse(userIdClaim);
			bool isAdmin = User.IsInRole("Admin");

			var task = await _context.Tasks.FindAsync(id);
			if (task == null)
				return NotFound("Task not found.");

			if (!isAdmin && task.UserId != userId)
				return Forbid("You are not allowed to update this task.");

			// Update task fields
			task.Title = taskDto.Title;
			task.Description = taskDto.Description;
			task.DueDate = taskDto.DueDate;
			task.IsCompleted = taskDto.IsCompleted;
			task.Priority = taskDto.Priority;
			task.Tags = taskDto.Tags;

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

			int userId = int.Parse(userIdClaim);
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
