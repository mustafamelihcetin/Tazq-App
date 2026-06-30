using System.Collections.Concurrent;

namespace Tazq_App.Services
{
    // Son N log kaydını bellekte tutan halka tampon. Amaç: admin panelden SSH'siz log
    // görüntüleme. Süreç yeniden başlayınca sıfırlanır (kalıcı arşiv değil; canlı teşhis için).
    public record LogEntry(DateTime Timestamp, string Level, string Category, string Message);

    public class InMemoryLogStore
    {
        private readonly ConcurrentQueue<LogEntry> _entries = new();
        private readonly int _capacity;

        public InMemoryLogStore(int capacity = 500)
        {
            _capacity = capacity;
        }

        public void Add(LogEntry entry)
        {
            _entries.Enqueue(entry);
            while (_entries.Count > _capacity && _entries.TryDequeue(out _)) { }
        }

        // En yeni önce; opsiyonel seviye filtresi (Warning/Error...).
        public IReadOnlyList<LogEntry> Recent(int max, string? level = null)
        {
            IEnumerable<LogEntry> q = _entries.ToArray();
            if (!string.IsNullOrWhiteSpace(level))
                q = q.Where(e => string.Equals(e.Level, level, StringComparison.OrdinalIgnoreCase));
            return q.Reverse().Take(Math.Clamp(max, 1, 1000)).ToList();
        }

        public int CountByLevel(string level)
            => _entries.Count(e => string.Equals(e.Level, level, StringComparison.OrdinalIgnoreCase));
    }
}
