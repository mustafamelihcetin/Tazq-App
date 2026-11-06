using System.Text.Json;
using System.Text.Json.Nodes;

namespace Tazq_App.Services
{
	/// <summary>
	/// HASSAS YEDEK ŞİFRELİ (2026-11-06). Tercih JSON'u veritabanında düz metindir; bırakma (sağlık verisi sayılabilir) ve birikim oraya öyle yazılamaz.
	/// Görevlerle aynı kullanıcı anahtarıyla mühürlenir; damga (at) açık kalır çünkü hangi kopyanın yeni olduğu çözmeden bilinmeli. Yalnız sahibine açık döner: admin dökümü mühürlü görür.
	/// </summary>
	public static class SensitivePrefs
	{
		private static readonly string[] Keys = { "__budget", "__quit" };

		public static string Seal(string json, ICryptoService crypto, int userId)
		{
			try
			{
				if (JsonNode.Parse(json) is not JsonObject o) return json;
				var key = crypto.GetKeyForUser(userId);
				var changed = false;
				foreach (var k in Keys)
				{
					if (o[k] is not JsonObject v || v["enc"] is not null) continue;
					o[k] = new JsonObject { ["at"] = v["at"]?.DeepClone(), ["enc"] = crypto.Encrypt(v.ToJsonString(), key) };
					changed = true;
				}
				return changed ? o.ToJsonString() : json;
			}
			catch (JsonException) { return json; }
		}

		public static string? Unseal(string? json, ICryptoService crypto, int userId)
		{
			if (string.IsNullOrEmpty(json) || !json.Contains("\"enc\"", StringComparison.Ordinal)) return json;
			try
			{
				if (JsonNode.Parse(json) is not JsonObject o) return json;
				foreach (var k in Keys)
				{
					if (o[k]?["enc"]?.GetValue<string>() is not { } cipher) continue;
					var plain = Open(cipher, crypto, userId);
					if (plain is null) o.Remove(k); else o[k] = JsonNode.Parse(plain);
				}
				return o.ToJsonString();
			}
			catch (JsonException) { return json; }
		}

		private static string? Open(string cipher, ICryptoService crypto, int userId)
		{
			foreach (var key in new[] { crypto.GetKeyForUser(userId) }.Concat(crypto.GetLegacyKeysForUser(userId)))
			{
				try { return crypto.Decrypt(cipher, key); }
				catch (Exception e) when (e is System.Security.Cryptography.CryptographicException or FormatException) { }
			}
			return null;
		}
	}

	/// <summary>
	/// BAYAT CİHAZ PLANI EZMESİN (2026-11-06). Tercihler tek JSON olarak bütün hâlde yazılıyor: uzun süredir açılmamış ikinci cihaz bağlanınca
	/// eski mod ve plan kopyasını gönderip yeni cihazda alınan kararı siliyordu. İstemcideki kapılar (wouldWipeModes, localPlansWin) yalnız kendi cihazını korur;
	/// son kapı sunucuda olmalı. Gelen yazının mod kararı damgası (__seasonalAt) saklıdan ESKİYSE plan anahtarları saklıdan korunur, gerisi (tema, bildirim vb.) yazılır.
	/// İstemci sonraki açılışta daha yeni damgayı görür ve kendini günceller. Bozuk JSON'a dokunulmaz: eski davranış aynen sürer.
	/// </summary>
	public static class PreferencesGuard
	{
		private const string StampKey = "__seasonalAt";

		private static bool IsPlanKey(string key) =>
			key == "seasonal" || key == "planSpecs" || key == StampKey
			|| key.EndsWith("PlanHabitIds", StringComparison.Ordinal) || key.EndsWith("PlanTaskIds", StringComparison.Ordinal);

		private static double StampOf(JsonObject o) =>
			o[StampKey] is JsonValue v && v.TryGetValue<double>(out var n) ? n : 0;

		/// <summary>Onaylı yedekler kendi damgasını taşır. Eski sürüm anahtarı hiç göndermez: silinmez. null: kullanıcı kapattı, silinir. Eski kopya yenisini ezemez.</summary>
		private static readonly string[] BackupKeys = { "__budget", "__quit" };

		private static bool KeepBackups(JsonObject old, JsonObject next)
		{
			var changed = false;
			foreach (var key in BackupKeys)
			{
				if (!old.TryGetPropertyValue(key, out var kept) || kept is null) continue;
				var sent = next.TryGetPropertyValue(key, out var v);
				if (sent && v is null) continue;
				var keepOld = !sent || (kept["at"] is JsonValue a && a.TryGetValue<double>(out var oldAt) && (v?["at"] is not JsonValue b || !b.TryGetValue<double>(out var newAt) || oldAt >= newAt));
				if (!keepOld) continue;
				next[key] = kept.DeepClone();
				changed = true;
			}
			return changed;
		}

		public static string Merge(string? stored, string incoming)
		{
			if (string.IsNullOrEmpty(stored) || stored == incoming) return incoming;
			try
			{
				if (JsonNode.Parse(stored) is not JsonObject old || JsonNode.Parse(incoming) is not JsonObject next) return incoming;
				var changed = KeepBackups(old, next);
				if (StampOf(next) < StampOf(old))
				{
					foreach (var key in next.Select(p => p.Key).Where(IsPlanKey).ToList()) next.Remove(key);
					foreach (var (key, value) in old)
					{
						if (IsPlanKey(key)) next[key] = value?.DeepClone();
					}
					changed = true;
				}
				return changed ? next.ToJsonString() : incoming;
			}
			catch (JsonException)
			{
				return incoming;
			}
		}
	}
}
