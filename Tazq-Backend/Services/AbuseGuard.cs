using System.Text.Json.Nodes;

namespace Tazq_App.Services
{
	/// <summary>
	/// KÖTÜYE KULLANIM KAPISI (2026-11-06). IP sınırı tek cihazı durdurur ama IP değiştireni durdurmaz; reddedilen de denemeyi bırakmaz, kimse de haberdar olmaz.
	///  · Hesap sınırı: hangi IP'den gelirse gelsin hesap başına dakikada 300, saatte 3.000 istek. IP sınırı dakikada 100 olduğu için aynı anda üç cihazı olan normal kullanıcı buna değmez.
	///  · Geçici engel: 10 dakikada 120 kez reddedilen IP ya da hesap 15 dakika kapıda çevrilir, istek veritabanına inmez. Kalıcı ban değil: yanlış alarm kendiliğinden biter.
	///  · Uyarı: yalnız sayı tutulur, IP ya da hesap kimliği panele çıkmaz (bkz. Snapshot).
	/// Bellekte durur: tek sunucu var, yeniden başlayınca sıfırlanması zararsız.
	/// </summary>
	public sealed class AbuseGuard
	{
		public const int AccountPerMinute = 300;
		public const int AccountPerHour = 3000;
		public const int StrikesToBlock = 120;
		public static readonly TimeSpan StrikeWindow = TimeSpan.FromMinutes(10);
		public static readonly TimeSpan BlockFor = TimeSpan.FromMinutes(15);
		private const int MaxKeys = 100_000;

		private sealed class Entry
		{
			public DateTime MinuteStart, HourStart, StrikeStart, BlockedUntil, LastTouched;
			public int MinuteCount, HourCount, Strikes;
		}

		private readonly Dictionary<string, Entry> _entries = new();
		private readonly Queue<DateTime> _blocks = new();
		private readonly Queue<DateTime> _rejects = new();
		private readonly Func<DateTime> _now;
		private readonly object _lock = new();

		public AbuseGuard() : this(() => DateTime.UtcNow) { }
		public AbuseGuard(Func<DateTime> now) { _now = now; }

		private Entry Get(string key, DateTime now)
		{
			if (!_entries.TryGetValue(key, out var e))
			{
				if (_entries.Count >= MaxKeys) Sweep(now);
				e = new Entry { MinuteStart = now, HourStart = now, StrikeStart = now };
				_entries[key] = e;
			}
			e.LastTouched = now;
			return e;
		}

		private void Sweep(DateTime now)
		{
			// Sahte IP'lerle belleği şişirmek de saldırıdır: boşta kalan kayıt atılır, engelli olan tutulur.
			foreach (var k in _entries.Where(p => p.Value.BlockedUntil <= now && now - p.Value.LastTouched > TimeSpan.FromHours(1)).Select(p => p.Key).ToList()) _entries.Remove(k);
			if (_entries.Count < MaxKeys) return;
			foreach (var k in _entries.Where(p => p.Value.BlockedUntil <= now).OrderBy(p => p.Value.LastTouched).Take(MaxKeys / 4).Select(p => p.Key).ToList()) _entries.Remove(k);
		}

		private static void Trim(Queue<DateTime> q, DateTime now)
		{
			while (q.Count > 0 && now - q.Peek() > TimeSpan.FromHours(1)) q.Dequeue();
		}

		public bool IsBlocked(string key, out int retryAfterSeconds)
		{
			var now = _now();
			lock (_lock)
			{
				retryAfterSeconds = 0;
				if (!_entries.TryGetValue(key, out var e) || e.BlockedUntil <= now) return false;
				retryAfterSeconds = (int)Math.Ceiling((e.BlockedUntil - now).TotalSeconds);
				_rejects.Enqueue(now);
				Trim(_rejects, now);
				return true;
			}
		}

		/// <summary>Reddedilen istek. Eşik aşılınca anahtar geçici olarak kapıda çevrilir.</summary>
		public void Strike(string key)
		{
			var now = _now();
			lock (_lock)
			{
				var e = Get(key, now);
				if (now - e.StrikeStart > StrikeWindow) { e.StrikeStart = now; e.Strikes = 0; }
				e.Strikes++;
				_rejects.Enqueue(now);
				Trim(_rejects, now);
				if (e.Strikes >= StrikesToBlock && e.BlockedUntil <= now)
				{
					e.BlockedUntil = now + BlockFor;
					e.Strikes = 0;
					_blocks.Enqueue(now);
					Trim(_blocks, now);
				}
			}
		}

		/// <summary>Hesap sınırı. false: reddet (ret sayılmış olur).</summary>
		public bool AllowAccount(int userId, out int retryAfterSeconds)
		{
			var key = $"u:{userId}";
			var now = _now();
			bool over;
			lock (_lock)
			{
				var e = Get(key, now);
				if (now - e.MinuteStart >= TimeSpan.FromMinutes(1)) { e.MinuteStart = now; e.MinuteCount = 0; }
				if (now - e.HourStart >= TimeSpan.FromHours(1)) { e.HourStart = now; e.HourCount = 0; }
				e.MinuteCount++;
				e.HourCount++;
				over = e.MinuteCount > AccountPerMinute || e.HourCount > AccountPerHour;
				retryAfterSeconds = !over ? 0 : e.HourCount > AccountPerHour
					? (int)Math.Ceiling((e.HourStart.AddHours(1) - now).TotalSeconds)
					: (int)Math.Ceiling((e.MinuteStart.AddMinutes(1) - now).TotalSeconds);
			}
			if (over) Strike(key);
			return !over;
		}

		/// <summary>Panel ve e-posta için son bir saat: kim olduğu değil, ne kadar olduğu.</summary>
		public JsonObject Snapshot()
		{
			var now = _now();
			lock (_lock)
			{
				Trim(_blocks, now);
				Trim(_rejects, now);
				return new JsonObject
				{
					["blockedNow"] = _entries.Values.Count(e => e.BlockedUntil > now),
					["blocksLastHour"] = _blocks.Count,
					["rejectedLastHour"] = _rejects.Count,
				};
			}
		}
	}
}
