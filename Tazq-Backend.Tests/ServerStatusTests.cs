using System.Text.Json.Nodes;
using Tazq_App.Services;
using Xunit;

namespace Tazq_Backend.Tests
{
	public class ServerStatusTests
	{
		private static string Temp(string content)
		{
			var p = Path.GetTempFileName();
			File.WriteAllText(p, content);
			return p;
		}

		[Fact]
		public void Gozlemci_sunucuyu_gorur_mudahale_uclari_yalniz_super_admin()
		{
			var read = typeof(Tazq_App.Controllers.AdminController).GetMethod("GetServerStatus")!;
			var attr = (Microsoft.AspNetCore.Authorization.AuthorizeAttribute)read.GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), false).Single();
			Assert.Equal(Tazq_App.Authorization.StaffPolicy.Insights, attr.Policy);
			var system = (Microsoft.AspNetCore.Authorization.AuthorizeAttribute)typeof(Tazq_App.Controllers.AdminSystemController).GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), false).Single();
			Assert.Equal(Tazq_App.Authorization.StaffPolicy.SuperAdmin, system.Policy);
		}

		[Fact]
		public void Dosya_yoksa_kontrol_bozuk_der()
		{
			var s = ServerStatus.Read("/yok/olmayan.json", DateTime.UtcNow);
			Assert.False(s["available"]!.GetValue<bool>());
			Assert.Contains("status_missing", ServerStatus.WarningsOf(s));
		}

		[Fact]
		public void Bozuk_dosya_cokertmez()
		{
			Assert.Contains("status_missing", ServerStatus.WarningsOf(ServerStatus.Read(Temp("{bozuk"), DateTime.UtcNow)));
		}

		[Fact]
		public void Taze_olcumde_yalniz_kendi_uyarilari_var()
		{
			var now = new DateTime(2026, 11, 6, 12, 0, 0, DateTimeKind.Utc);
			var s = ServerStatus.Read(Temp("{\"at\":\"2026-11-06T11:58:00+00:00\",\"warnings\":[\"disk_high\"]}"), now);
			Assert.False(s["stale"]!.GetValue<bool>());
			Assert.Equal(new[] { "disk_high" }, ServerStatus.WarningsOf(s));
		}

		[Fact]
		public void Betik_durduysa_bayat_uyarisi_eklenir()
		{
			var now = new DateTime(2026, 11, 6, 12, 0, 0, DateTimeKind.Utc);
			var s = ServerStatus.Read(Temp("{\"at\":\"2026-11-06T11:00:00+00:00\",\"warnings\":[]}"), now);
			Assert.True(s["stale"]!.GetValue<bool>());
			Assert.Contains("status_stale", ServerStatus.WarningsOf(s));
		}

		[Fact]
		public void Ayni_uyari_gunde_bir_kez_duzelen_tekrar_bildirilir()
		{
			var m = new WatchMemory();
			var t = new DateTime(2026, 11, 6, 0, 0, 0, DateTimeKind.Utc);
			Assert.Equal(new[] { "disk_high" }, m.Due(new[] { "disk_high" }, t));
			Assert.Empty(m.Due(new[] { "disk_high" }, t.AddHours(1)));
			Assert.Equal(new[] { "disk_high" }, m.Due(new[] { "disk_high" }, t.AddHours(25)));
			Assert.Empty(m.Due(Array.Empty<string>(), t.AddHours(26)));
			Assert.Equal(new[] { "disk_high" }, m.Due(new[] { "disk_high" }, t.AddHours(27)));
		}

		[Fact]
		public void Hassas_yedek_diskte_sifreli_sahibine_acik_doner()
		{
			var crypto = new FakeCrypto();
			var plain = "{\"__seasonalAt\":1,\"__quit\":{\"at\":5,\"items\":[{\"name\":\"Sigara\"}]},\"theme\":\"x\"}";
			var sealedJson = SensitivePrefs.Seal(plain, crypto, 7);
			Assert.DoesNotContain("Sigara", sealedJson);
			Assert.Contains("\"theme\":\"x\"", sealedJson);
			var r = JsonNode.Parse(sealedJson)!.AsObject();
			Assert.Equal(5, r["__quit"]!["at"]!.GetValue<double>());
			var open = JsonNode.Parse(SensitivePrefs.Unseal(sealedJson, crypto, 7)!)!.AsObject();
			Assert.Equal("Sigara", open["__quit"]!["items"]![0]!["name"]!.GetValue<string>());
		}

		[Fact]
		public void Cozulemeyen_yedek_tercihleri_bozmaz_yalniz_kendisi_duser()
		{
			var crypto = new FakeCrypto { Broken = true };
			const string json = "{\"theme\":\"x\",\"__budget\":{\"at\":5,\"enc\":\"zzz\"}}";
			var open = JsonNode.Parse(SensitivePrefs.Unseal(json, crypto, 7)!)!.AsObject();
			Assert.Equal("x", open["theme"]!.GetValue<string>());
			Assert.Null(open["__budget"]);
		}

		[Fact]
		public void Birlestirme_muhurlu_kopyayi_korur_ayni_damgada_yeniden_sifrelemez()
		{
			var crypto = new FakeCrypto();
			var stored = SensitivePrefs.Seal("{\"__seasonalAt\":1,\"__budget\":{\"at\":5,\"v\":1}}", crypto, 7);
			var merged = PreferencesGuard.Merge(stored, "{\"__seasonalAt\":2,\"__budget\":{\"at\":5,\"v\":1},\"theme\":\"y\"}");
			Assert.Equal(JsonNode.Parse(stored)!["__budget"]!.ToJsonString(), JsonNode.Parse(merged)!["__budget"]!.ToJsonString());
		}

		private sealed class FakeCrypto : ICryptoService
		{
			public bool Broken;
			public string Encrypt(string plainText, byte[] key) => "E" + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(plainText));
			public string Decrypt(string c, byte[] key)
			{
				if (Broken) throw new System.Security.Cryptography.CryptographicException();
				return System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(c[1..]));
			}
			public byte[] GetKeyForUser(int userId) => new byte[32];
			public IReadOnlyList<byte[]> GetLegacyKeysForUser(int userId) => Array.Empty<byte[]>();
			public string ComputeBlindIndex(string input, byte[] key) => input;
		}
	}
}
