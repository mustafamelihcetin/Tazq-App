using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Tazq_App.Data;
using Tazq_App.Models;

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

		// Retrieves tasks with optional filtering and sorting
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

			var query = _context.Tasks
				.Include(t => t.User)
				.AsQueryable();

			if (!isAdmin)
				query = query.Where(t => t.UserId == userId);

			// Apply tag filtering
			if (!string.IsNullOrEmpty(tag))
			{
				query = query.Where(t => t.TagsJson.Contains($"\"{tag}\""));
			}

			// Apply search filter
			if (!string.IsNullOrEmpty(search))
			{
				query = query.Where(t => t.Title.Contains(search) || t.Description.Contains(search));
			}

			// Filter by completion status
			if (isCompleted.HasValue)
			{
				query = query.Where(t => t.IsCompleted == isCompleted.Value);
			}

			// Filter by date range
			if (startDate.HasValue)
			{
				query = query.Where(t => t.DueDate >= startDate.Value);
			}

			if (endDate.HasValue)
			{
				query = query.Where(t => t.DueDate <= endDate.Value);
			}

			// Apply sorting
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

		// Retrieves a specific task by ID
		[HttpGet("{id}")]
		public async Task<IActionResult> GetTaskById(int id)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			int userId = int.Parse(userIdClaim);
			bool isAdmin = User.IsInRole("Admin");

			var task = await _context.Tasks
				.Include(t => t.User)
				.FirstOrDefaultAsync(t => t.Id == id);

			if (task == null)
				return NotFound();

			if (!isAdmin && task.UserId != userId)
				return Forbid("You are not allowed to access this task.");

			return Ok(task);
		}

		// Retrieves statistics about user tasks
		[HttpGet("stats")]
		public async Task<IActionResult> GetTaskStats()
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			int userId = int.Parse(userIdClaim);
			bool isAdmin = User.IsInRole("Admin");

			var query = _context.Tasks.AsQueryable();

			if (!isAdmin)
			{
				query = query.Where(t => t.UserId == userId);
			}

			var totalTasks = await query.CountAsync();
			var completedTasks = await query.CountAsync(t => t.IsCompleted);
			var pendingTasks = totalTasks - completedTasks;

			return Ok(new
			{
				TotalTasks = totalTasks,
				CompletedTasks = completedTasks,
				PendingTasks = pendingTasks
			});
		}


		// Creates a new task
		[HttpPost]
		public async Task<IActionResult> CreateTask(TaskItem task)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			task.UserId = int.Parse(userIdClaim);
			task.Tags = task.Tags ?? new List<string>(); // Ensure tags list is not null

			_context.Tasks.Add(task);
			await _context.SaveChangesAsync();
			return CreatedAtAction(nameof(GetTaskById), new { id = task.Id }, task);
		}

		// Bulk create tasks
		[HttpPost("bulk")]
		public async Task<IActionResult> CreateTasks([FromBody] List<TaskItem> tasks)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			int userId = int.Parse(userIdClaim);

			foreach (var task in tasks)
			{
				task.UserId = userId;
				task.Tags = task.Tags ?? new List<string>(); // Ensure tags are not null
			}

			_context.Tasks.AddRange(tasks);
			await _context.SaveChangesAsync();

			return Ok(new { message = $"{tasks.Count} tasks created successfully." });
		}

		// Updates specific fields of an existing task
		[HttpPatch("{id}")]
		public async Task<IActionResult> PatchTask(int id, [FromBody] TaskUpdateDto updateDto)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			int userId = int.Parse(userIdClaim);
			bool isAdmin = User.IsInRole("Admin");

			var existingTask = await _context.Tasks.FindAsync(id);
			if (existingTask == null)
				return NotFound();

			if (!isAdmin && existingTask.UserId != userId)
				return Forbid("You are not allowed to modify this task.");

			if (!string.IsNullOrEmpty(updateDto.Title))
				existingTask.Title = updateDto.Title;

			if (!string.IsNullOrEmpty(updateDto.Description))
				existingTask.Description = updateDto.Description;

			if (updateDto.DueDate.HasValue)
				existingTask.DueDate = updateDto.DueDate.Value;

			if (updateDto.IsCompleted.HasValue)
				existingTask.IsCompleted = updateDto.IsCompleted.Value;

			if (updateDto.Priority.HasValue)
				existingTask.Priority = updateDto.Priority.Value;

			if (updateDto.Tags != null)
				existingTask.Tags = updateDto.Tags;

			_context.Entry(existingTask).State = EntityState.Modified;
			await _context.SaveChangesAsync();
			return Ok(existingTask);
		}

		// Marks a task as completed
		[HttpPatch("{id}/complete")]
		public async Task<IActionResult> CompleteTask(int id)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			int userId = int.Parse(userIdClaim);
			bool isAdmin = User.IsInRole("Admin");

			var existingTask = await _context.Tasks.FindAsync(id);
			if (existingTask == null)
				return NotFound();

			if (!isAdmin && existingTask.UserId != userId)
				return Forbid("You are not allowed to modify this task.");

			existingTask.IsCompleted = true;
			_context.Entry(existingTask).State = EntityState.Modified;
			await _context.SaveChangesAsync();
			return Ok(existingTask);
		}

		// Deletes a task
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
				return NotFound();

			if (!isAdmin && task.UserId != userId)
				return Forbid("You are not allowed to delete this task.");

			_context.Tasks.Remove(task);
			await _context.SaveChangesAsync();
			return NoContent();
		}
	}

	// DTO for updating tasks
	public class TaskUpdateDto
	{
		public string? Title { get; set; }
		public string? Description { get; set; }
		public DateTime? DueDate { get; set; }
		public bool? IsCompleted { get; set; }
		public TaskPriority? Priority { get; set; }
		public List<string>? Tags { get; set; }
	}
}
