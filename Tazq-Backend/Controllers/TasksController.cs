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
        private readonly ITaskService _taskService;

        public TasksController(ITaskService taskService)
        {
            _taskService = taskService;
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

            var taskList = await _taskService.GetTasksAsync(userId.Value, tag, search, sortBy, isCompleted, startDate, endDate);
            return Ok(taskList);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetTaskById(int id)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized("User ID not found in token.");

            var task = await _taskService.GetTaskByIdAsync(userId.Value, id);
            if (task == null)
                return NotFound();

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
                var createdTask = await _taskService.CreateTaskAsync(userId.Value, task);
                return CreatedAtAction(nameof(GetTaskById), new { id = createdTask.Id }, createdTask);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { StatusCode = 500, Message = ex.Message });
            }
        }

        [HttpPost("bulk")]
        public async Task<IActionResult> CreateTasks([FromBody] TaskRequestDto taskRequest)
        {
            if (taskRequest?.Tasks == null || !taskRequest.Tasks.Any())
                return BadRequest("Invalid request body.");

            var userId = GetUserId();
            if (userId == null)
                return Unauthorized();

            var taskItems = taskRequest.Tasks.Select(t => new TaskItem
            {
                Title = t.Title,
                Description = t.Description,
                DueDate = t.DueDate,
                DueTime = t.DueTime,
                IsCompleted = t.IsCompleted,
                Priority = t.Priority,
                Tags = t.Tags
            }).ToList();

            var success = await _taskService.CreateTasksBulkAsync(userId.Value, taskItems);
            return success ? Ok("Tasks created.") : StatusCode(500, "Error creating tasks.");
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTask(int id, [FromBody] TaskItem updatedTask)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized();

            var task = await _taskService.UpdateTaskAsync(userId.Value, id, updatedTask);
            if (task == null)
                return NotFound();

            return Ok(new { message = "Task updated successfully.", task });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized();

            var success = await _taskService.DeleteTaskAsync(userId.Value, id);
            return success ? NoContent() : NotFound();
        }
    }
}