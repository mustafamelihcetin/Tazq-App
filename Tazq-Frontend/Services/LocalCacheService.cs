using System.Text.Json;
using Tazq_Frontend.Models;

namespace Tazq_Frontend.Services
{
    public class LocalCacheService
    {
        private readonly string _cacheFile = Path.Combine(FileSystem.AppDataDirectory, "tasks_cache.json");

        public async Task SaveTasks(List<TaskModel> tasks)
        {
            try
            {
                var json = JsonSerializer.Serialize(tasks);
                await File.WriteAllTextAsync(_cacheFile, json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CACHE] Save error: {ex.Message}");
            }
        }

        public async Task<List<TaskModel>> GetTasks()
        {
            try
            {
                if (!File.Exists(_cacheFile))
                    return new List<TaskModel>();

                var json = await File.ReadAllTextAsync(_cacheFile);
                return JsonSerializer.Deserialize<List<TaskModel>>(json) ?? new List<TaskModel>();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CACHE] Load error: {ex.Message}");
                return new List<TaskModel>();
            }
        }
    }
}
