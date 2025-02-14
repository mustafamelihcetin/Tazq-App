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

		[HttpGet]
		public async Task<IActionResult> GetTasks()
		{
			var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userId == null)
				return Unauthorized();

			var tasks = await _context.Tasks
				.Where(t => t.UserId == int.Parse(userId))
				.ToListAsync();

			return Ok(tasks);
		}

		[HttpGet("{id}")]
		public async Task<IActionResult> GetTaskById(int id)
		{
			var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userId == null)
				return Unauthorized();

			var task = await _context.Tasks.FindAsync(id);
			if (task == null || task.UserId != int.Parse(userId))
			{
				return NotFound();
			}

			return Ok(task);
		}

		[HttpPost]
		public async Task<IActionResult> CreateTask(TaskItem task)
		{
			var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userId == null)
				return Unauthorized();

			task.UserId = int.Parse(userId);

			_context.Tasks.Add(task);
			await _context.SaveChangesAsync();
			return CreatedAtAction(nameof(GetTaskById), new { id = task.Id }, task);
		}

		[HttpPut("{id}")]
		public async Task<IActionResult> UpdateTask(int id, TaskItem task)
		{
			var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userId == null)
				return Unauthorized();

			if (id != task.Id)
			{
				return BadRequest();
			}

			var existingTask = await _context.Tasks.FindAsync(id);
			if (existingTask == null || existingTask.UserId != int.Parse(userId))
			{
				return NotFound();
			}

			existingTask.Title = task.Title;
			existingTask.Description = task.Description;
			existingTask.DueDate = task.DueDate;
			existingTask.IsCompleted = task.IsCompleted;
			existingTask.Priority = task.Priority;

			_context.Entry(existingTask).State = EntityState.Modified;
			await _context.SaveChangesAsync();
			return NoContent();
		}

		[HttpDelete("{id}")]
		public async Task<IActionResult> DeleteTask(int id)
		{
			var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userId == null)
				return Unauthorized();

			var task = await _context.Tasks.FindAsync(id);
			if (task == null || task.UserId != int.Parse(userId))
			{
				return NotFound();
			}

			_context.Tasks.Remove(task);
			await _context.SaveChangesAsync();
			return NoContent();
		}
	}
}
