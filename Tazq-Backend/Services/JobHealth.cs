using System.Collections.Concurrent;

namespace Tazq_App.Services
{
    // ARKA PLAN İŞ SAĞLIĞI (madde 9). Zamanlanmış işler (hesap temizleme, admin özeti) ve mail
    // kuyruğu yalnız log yazıyordu: bir iş günlerce sessizce düşse admin panelinden görünmezdi.
    // Her iş her turda Ok/Fail bildirir; panel "son çalışma, son hata, gecikiyor mu" sorusunu
    // tek bakışta cevaplar.
    //
    // Bilerek bellekte: kalıcı tablo yerine süreç ömrü kadar tutulur (süreç yeniden başlayınca
    // sayaçlar sıfırlanır, `since` alanı bunu söyler). Amaç tarihçe değil "şu an çalışıyor mu".
    public sealed class JobHealth
    {
        public enum Status { Ok, Failing, Late, Waiting }

        public sealed record Snapshot(
            string Key, Status State, double IntervalMinutes,
            DateTime? LastRunAt, DateTime? LastOkAt, DateTime? LastErrorAt, string? LastError,
            int Runs, int Failures, int? Pending, DateTime Since);

        private sealed class Entry
        {
            public required string Key;
            public required TimeSpan Interval;
            public required DateTime Since;
            public DateTime? LastRunAt, LastOkAt, LastErrorAt;
            public string? LastError;
            public int Runs, Failures;
        }

        private readonly ConcurrentDictionary<string, Entry> _jobs = new();
        private readonly Func<DateTime> _now;
        private Func<int>? _pending;

        public JobHealth() : this(() => DateTime.UtcNow) { }
        public JobHealth(Func<DateTime> now) { _now = now; }

        public const string AccountPurge = "account-purge";
        public const string SignupDigest = "signup-digest";
        public const string MailQueue = "mail-queue";
        public const string CrashRetention = "crash-retention";

        /// <param name="interval">Beklenen tur aralığı; kuyruk için 0 (olay güdümlü, gecikme yok).</param>
        public void Register(string key, TimeSpan interval) =>
            _jobs.TryAdd(key, new Entry { Key = key, Interval = interval, Since = _now() });

        /// <summary>Kuyruktaki bekleyen iş sayısı (yalnız mail kuyruğu).</summary>
        public void TrackPending(Func<int> pending) => _pending = pending;

        public void Ok(string key)
        {
            var e = Get(key); var now = _now();
            lock (e) { e.Runs++; e.LastRunAt = now; e.LastOkAt = now; }
        }

        public void Fail(string key, Exception ex)
        {
            var e = Get(key); var now = _now();
            lock (e)
            {
                e.Runs++; e.Failures++; e.LastRunAt = now; e.LastErrorAt = now;
                // Yalnız tür + ilk satır: yığın izi ve olası kişisel veri panele taşınmaz (tamamı logda).
                var msg = ex.Message.Split('\n')[0].Trim();
                e.LastError = $"{ex.GetType().Name}: {(msg.Length > 160 ? msg[..160] + "…" : msg)}";
            }
        }

        public IReadOnlyList<Snapshot> All()
        {
            var now = _now();
            return _jobs.Values.OrderBy(e => e.Key).Select(e =>
            {
                lock (e)
                {
                    return new Snapshot(e.Key, StateOf(e, now), e.Interval.TotalMinutes,
                        e.LastRunAt, e.LastOkAt, e.LastErrorAt, e.LastError, e.Runs, e.Failures,
                        e.Key == MailQueue ? _pending?.Invoke() : null, e.Since);
                }
            }).ToList();
        }

        private static Status StateOf(Entry e, DateTime now)
        {
            // Son tur hatalıysa: düzelene kadar kırmızı.
            if (e.LastErrorAt != null && (e.LastOkAt == null || e.LastErrorAt > e.LastOkAt)) return Status.Failing;
            if (e.Interval <= TimeSpan.Zero) return e.LastRunAt == null ? Status.Waiting : Status.Ok;
            // İki tur + 5 dk pay geçtiyse iş takılmış demektir (ilk tur başlangıç gecikmesini de kapsar).
            var deadline = (e.LastRunAt ?? e.Since) + e.Interval * 2 + TimeSpan.FromMinutes(5);
            if (now > deadline) return Status.Late;
            return e.LastRunAt == null ? Status.Waiting : Status.Ok;
        }

        private Entry Get(string key) =>
            _jobs.GetOrAdd(key, k => new Entry { Key = k, Interval = TimeSpan.Zero, Since = _now() });
    }
}
