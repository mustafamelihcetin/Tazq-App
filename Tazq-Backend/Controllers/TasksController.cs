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

		// Retrieve tasks based on user role
		[HttpGet]
		public async Task<IActionResult> GetTasks()
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			int userId = int.Parse(userIdClaim);
			bool isAdmin = User.IsInRole("Admin");

			var tasks = await _context.Tasks
				.Where(t => isAdmin || t.UserId == userId)
				.ToListAsync();

			return Ok(tasks);
		}

		// Retrieve a specific task by ID
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
		public async Task<IActionResult> CreateTask(TaskItem task)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			task.UserId = int.Parse(userIdClaim);
			_context.Tasks.Add(task);
			await _context.SaveChangesAsync();
			return CreatedAtAction(nameof(GetTaskById), new { id = task.Id }, task);
		}

		// Update an existing task
		[HttpPut("{id}")]
		public async Task<IActionResult> UpdateTask(int id, TaskItem task)
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

			existingTask.Title = task.Title;
			existingTask.Description = task.Description;
			existingTask.DueDate = task.DueDate;
			existingTask.IsCompleted = task.IsCompleted;
			existingTask.Priority = task.Priority;

			_context.Entry(existingTask).State = EntityState.Modified;
			await _context.SaveChangesAsync();
			return NoContent();
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
				return NotFound();

			if (!isAdmin && task.UserId != userId)
				return Forbid("You are not allowed to delete this task.");

			_context.Tasks.Remove(task);
			await _context.SaveChangesAsync();
			return NoContent();
		}
	}
}
