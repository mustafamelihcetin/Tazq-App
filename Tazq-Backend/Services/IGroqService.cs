namespace Tazq_App.Services
{
    public interface IGroqService
    {
        Task<List<ParsedTask>> ParseTasksFromTextAsync(string userText);
    }

    public class ParsedTask
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Priority { get; set; } = "Medium";
        public string? DueDate { get; set; }
        public List<string> Tags { get; set; } = new();
    }
}
