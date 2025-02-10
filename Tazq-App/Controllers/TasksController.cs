using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Controllers
{
	[Route("api/tasks")]
	[ApiController]
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
			var tasks = await _context.Tasks.ToListAsync();
			return Ok(tasks);
		}

		[HttpGet("{id}")]
		public async Task<IActionResult> GetTaskById(int id)
		{
			var task = await _context.Tasks.FindAsync(id);
			if (task == null)
			{
				return NotFound();
			}
			return Ok(task);
		}

		[HttpPost]
		public async Task<IActionResult> CreateTask(TaskItem task)
		{
			_context.Tasks.Add(task);
			await _context.SaveChangesAsync();
			return CreatedAtAction(nameof(GetTaskById), new { id = task.Id }, task);
		}

		[HttpPut("{id}")]
		public async Task<IActionResult> UpdateTask(int id, TaskItem task)
		{
			if (id != task.Id)
			{
				return BadRequest();
			}

			_context.Entry(task).State = EntityState.Modified;
			await _context.SaveChangesAsync();
			return NoContent();
		}

		[HttpDelete("{id}")]
		public async Task<IActionResult> DeleteTask(int id)
		{
			var task = await _context.Tasks.FindAsync(id);
			if (task == null)
			{
				return NotFound();
			}

			_context.Tasks.Remove(task);
			await _context.SaveChangesAsync();
			return NoContent();
		}
	}
}
