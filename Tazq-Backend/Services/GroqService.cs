using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Tazq_App.Services
{
    public class GroqService : IGroqService
    {
        private readonly HttpClient _http;
        private readonly string? _apiKey;
        private readonly string _today;

        public GroqService(IHttpClientFactory httpFactory)
        {
            _http = httpFactory.CreateClient();
            _apiKey = Environment.GetEnvironmentVariable("GROQ_API_KEY");
            _today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        }

        public async Task<List<ParsedTask>> ParseTasksFromTextAsync(string userText)
        {
            if (string.IsNullOrWhiteSpace(_apiKey))
                throw new InvalidOperationException("GROQ_API_KEY is not configured.");

            var systemPrompt = $$"""
                You are a task extraction assistant. Today is {{_today}}.
                Parse the user's text and extract individual tasks as a JSON array.
                Each task must have: title, description, priority (Low/Medium/High), dueDate (ISO date or null), tags (string array).
                Return ONLY a valid JSON array, no markdown, no explanation.
                Example: [{"title":"Buy groceries","description":"","priority":"Medium","dueDate":null,"tags":["personal"]}]
                """;

            var body = new
            {
                model = "llama-3.1-8b-instant",
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userText }
                },
                temperature = 0.3,
                max_tokens = 1024
            };

            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
            request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            var response = await _http.SendAsync(request);
            var raw = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"Groq API error: {raw}");

            using var doc = JsonDocument.Parse(raw);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "[]";

            // Strip markdown code blocks if present
            content = content.Trim();
            if (content.StartsWith("```")) content = content.Split('\n', 2)[1];
            if (content.EndsWith("```")) content = content[..^3];

            var tasks = JsonSerializer.Deserialize<List<ParsedTask>>(content.Trim(), new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? new List<ParsedTask>();

            return tasks;
        }
    }
}
