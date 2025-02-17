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

		// Retrieve only the tasks of the authenticated user
		[HttpGet]
		public async Task<IActionResult> GetTasks()
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			int userId = int.Parse(userIdClaim);

			var tasks = await _context.Tasks
				.Include(t => t.User)
				.Include(t => t.AssignedByUser)
				.Where(t => t.UserId == userId)
				.ToListAsync();

			return Ok(tasks);
		}

		// Retrieve a specific task owned by the authenticated user
		[HttpGet("{id}")]
		public async Task<IActionResult> GetTaskById(int id)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			int userId = int.Parse(userIdClaim);

			var task = await _context.Tasks
				.Include(t => t.User)
				.Include(t => t.AssignedByUser)
				.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

			if (task == null)
				return NotFound("Task not found or you do not have permission to view it.");

			return Ok(task);
		}

		// Create a new task only for the authenticated user
		[HttpPost]
		public async Task<IActionResult> CreateTask([FromBody] TaskItem task)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			task.UserId = int.Parse(userIdClaim); // Always assign task to the authenticated user

			_context.Tasks.Add(task);
			await _context.SaveChangesAsync();
			return CreatedAtAction(nameof(GetTaskById), new { id = task.Id }, task);
		}

		// Update only tasks that belong to the authenticated user
		[HttpPut("{id}")]
		public async Task<IActionResult> UpdateTask(int id, [FromBody] TaskItem updatedTask)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			int userId = int.Parse(userIdClaim);

			var existingTask = await _context.Tasks
				.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

			if (existingTask == null)
				return NotFound("Task not found or you do not have permission to modify it.");

			existingTask.Title = updatedTask.Title;
			existingTask.Description = updatedTask.Description;
			existingTask.DueDate = updatedTask.DueDate;
			existingTask.IsCompleted = updatedTask.IsCompleted;
			existingTask.Priority = updatedTask.Priority;

			_context.Entry(existingTask).State = EntityState.Modified;
			await _context.SaveChangesAsync();
			return NoContent();
		}

		// Delete only tasks that belong to the authenticated user
		[HttpDelete("{id}")]
		public async Task<IActionResult> DeleteTask(int id)
		{
			var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userIdClaim == null)
				return Unauthorized("User ID not found in token.");

			int userId = int.Parse(userIdClaim);

			var task = await _context.Tasks
				.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

			if (task == null)
				return NotFound("Task not found or you do not have permission to delete it.");

			_context.Tasks.Remove(task);
			await _context.SaveChangesAsync();
			return NoContent();
		}
	}
}
