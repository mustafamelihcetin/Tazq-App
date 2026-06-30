using Microsoft.Extensions.Logging;

namespace Tazq_App.Services
{
    // Logları InMemoryLogStore'a yazan hafif ILoggerProvider. Varsayılan eşik Warning
    // (gürültüyü düşük tutar; istek-başı Information logları tamponu doldurmasın).
    public class InMemoryLoggerProvider : ILoggerProvider
    {
        private readonly InMemoryLogStore _store;
        private readonly LogLevel _min;

        public InMemoryLoggerProvider(InMemoryLogStore store, LogLevel min = LogLevel.Warning)
        {
            _store = store;
            _min = min;
        }

        public ILogger CreateLogger(string categoryName) => new InMemoryLogger(_store, categoryName, _min);

        public void Dispose() { }

        private class InMemoryLogger : ILogger
        {
            private readonly InMemoryLogStore _store;
            private readonly string _category;
            private readonly LogLevel _min;

            public InMemoryLogger(InMemoryLogStore store, string category, LogLevel min)
            {
                _store = store;
                _category = category;
                _min = min;
            }

            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => logLevel >= _min && logLevel != LogLevel.None;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            {
                if (!IsEnabled(logLevel)) return;
                var message = formatter(state, exception);
                if (exception != null) message += $" | {exception.GetType().Name}: {exception.Message}";
                // Kategori adını kısalt (son segment) — okunabilirlik.
                var shortCat = _category.Contains('.') ? _category[(_category.LastIndexOf('.') + 1)..] : _category;
                _store.Add(new LogEntry(DateTime.UtcNow, logLevel.ToString(), shortCat, message));
            }
        }
    }
}
