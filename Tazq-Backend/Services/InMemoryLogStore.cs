using System.Collections.Concurrent;

namespace Tazq_App.Services
{
    // Son N log kaydını bellekte tutan halka tampon. Amaç: admin panelden SSH'siz log
    // görüntüleme. Süreç yeniden başlayınca sıfırlanır (kalıcı arşiv değil; canlı teşhis için).

    /// <summary>
    /// Kaydı ÜRETEN istemci.
    ///
    /// NEDEN GEREKLİ: geliştirme sürümü de production API'ye bağlanıyor (bkz. app.config.js
    /// — `apiUrl` her iki varyantta da api.tazqapp.com). Yani geliştirme sırasında çıkan
    /// hatalar canlı log havuzuna karışıyor ve admin panelde "gerçek kullanıcıda ne
    /// kırıldı?" sorusu cevaplanamaz hâle geliyordu.
    ///
    /// Kaynak SİLİNMİYOR, ETİKETLENİYOR: geliştirme hataları da bakılmak istenebilir.
    /// Ayırmak filtrelemenin işi, kaydetmemenin değil.
    /// </summary>
    public enum LogSource
    {
        /// <summary>İstemci kendini bildirmedi — sunucu içi iş, zamanlanmış görev, bilinmeyen çağrı.</summary>
        Unknown = 0,
        /// <summary>Yayındaki uygulama.</summary>
        Production = 1,
        /// <summary>Geliştirme sürümü (TAZQ Dev / com.tazqapp.tazq.dev).</summary>
        Development = 2,
    }

    public record LogEntry(DateTime Timestamp, string Level, string Category, string Message, LogSource Source);

    /// <summary>
    /// Sayfalanmış sonuç. `Total` olmadan istemci "sonraki sayfa var mı?" sorusunu
    /// cevaplayamaz ve kullanıcıyı boş sayfaya tıklatır.
    /// </summary>
    public record LogPage(IReadOnlyList<LogEntry> Items, int Total, int Offset, int Limit);

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

        /// <summary>
        /// En yeni önce, SAYFALANMIŞ.
        ///
        /// Eskiden yalnız `Recent(max, level)` vardı: baştan N kaydı döndürüyor, gerisine
        /// ulaşmanın yolu bulunmuyordu. Tampon 500 kayıt tutuyor, panel 200 istiyor ve
        /// 60'ını çiziyordu — yani kayıtların çoğu VARDI ama görülemiyordu.
        /// </summary>
        public LogPage Page(int limit, int offset = 0, string? level = null, LogSource? source = null)
        {
            limit = Math.Clamp(limit, 1, 200);
            offset = Math.Max(offset, 0);

            IEnumerable<LogEntry> q = _entries.ToArray().Reverse();
            if (!string.IsNullOrWhiteSpace(level))
                q = q.Where(e => string.Equals(e.Level, level, StringComparison.OrdinalIgnoreCase));
            if (source.HasValue)
                q = q.Where(e => e.Source == source.Value);

            var filtered = q.ToList();
            return new LogPage(filtered.Skip(offset).Take(limit).ToList(), filtered.Count, offset, limit);
        }

        /// <summary>Geriye dönük uyumluluk — sayfalamasız çağrılar için ince sarmalayıcı.</summary>
        public IReadOnlyList<LogEntry> Recent(int max, string? level = null)
            => Page(max, 0, level).Items;

        /// <summary>
        /// Seviye sayacı. `source` verilirse yalnız o kaynağı sayar — sağlık özetindeki
        /// "hata sayısı" geliştirme gürültüsüyle şişmesin.
        /// </summary>
        public int CountByLevel(string level, LogSource? source = null)
            => _entries.Count(e =>
                string.Equals(e.Level, level, StringComparison.OrdinalIgnoreCase)
                && (!source.HasValue || e.Source == source.Value));

        /// <summary>Panelin filtre sayaçlarını tek turda vermek için.</summary>
        public IReadOnlyDictionary<string, int> CountBySource()
            => _entries.ToArray()
                .GroupBy(e => e.Source.ToString())
                .ToDictionary(g => g.Key, g => g.Count());
    }
}
