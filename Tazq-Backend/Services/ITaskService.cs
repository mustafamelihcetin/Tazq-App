using Tazq_App.Models;

namespace Tazq_App.Services
{
    public interface ITaskService
    {
        Task<List<TaskItem>> GetTasksAsync(int userId, string? tag, string? search, string? sortBy, bool? isCompleted, DateTime? startDate, DateTime? endDate);
        Task<TaskItem?> GetTaskByIdAsync(int userId, int taskId);
        Task<TaskItem> CreateTaskAsync(int userId, TaskItem task);
        Task<bool> CreateTasksBulkAsync(int userId, List<TaskItem> tasks);
        Task<TaskItem?> UpdateTaskAsync(int userId, int taskId, TaskItem updatedTask);
        Task<bool> DeleteTaskAsync(int userId, int taskId);
    }
}
