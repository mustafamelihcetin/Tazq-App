using System.Text.Json.Nodes;
using Tazq_App.Services;
using Xunit;

namespace Tazq_Backend.Tests
{
	public class PreferencesGuardTests
	{
		private const string Stored = "{\"__seasonalAt\":2000,\"seasonal\":{\"tez\":true},\"planSpecs\":{\"tez\":{\"d\":1}},\"tezPlanTaskIds\":[5],\"theme\":\"old\"}";

		[Fact]
		public void Eski_damgali_yazi_plani_ezemez_ama_gerisi_yazilir()
		{
			var r = JsonNode.Parse(PreferencesGuard.Merge(Stored, "{\"__seasonalAt\":1000,\"seasonal\":{\"tez\":false},\"examPlanTaskIds\":[9],\"theme\":\"new\"}"))!.AsObject();
			Assert.True(r["seasonal"]!["tez"]!.GetValue<bool>());
			Assert.Equal(2000, r["__seasonalAt"]!.GetValue<double>());
			Assert.Equal(5, r["tezPlanTaskIds"]![0]!.GetValue<int>());
			Assert.Null(r["examPlanTaskIds"]);
			Assert.Equal("new", r["theme"]!.GetValue<string>());
		}

		[Fact]
		public void Yeni_ya_da_ayni_damgali_yazi_aynen_gecer()
		{
			const string newer = "{\"__seasonalAt\":3000,\"seasonal\":{\"tez\":false}}";
			const string same = "{\"__seasonalAt\":2000,\"seasonal\":{\"tez\":false}}";
			Assert.Equal(newer, PreferencesGuard.Merge(Stored, newer));
			Assert.Equal(same, PreferencesGuard.Merge(Stored, same));
		}

		[Fact]
		public void Damgasiz_eski_istemci_plani_ezemez()
		{
			var r = JsonNode.Parse(PreferencesGuard.Merge(Stored, "{\"seasonal\":{},\"theme\":\"x\"}"))!.AsObject();
			Assert.True(r["seasonal"]!["tez"]!.GetValue<bool>());
		}

		[Theory]
		[InlineData(null)]
		[InlineData("")]
		[InlineData("bozuk{")]
		public void Saklı_yok_ya_da_bozuksa_gelen_yazilir(string? stored)
		{
			const string next = "{\"__seasonalAt\":1,\"seasonal\":{}}";
			Assert.Equal(next, PreferencesGuard.Merge(stored, next));
		}

		[Fact]
		public void Yedek_anahtari_gondermeyen_eski_surum_yedegi_silemez()
		{
			const string stored = "{\"__seasonalAt\":1,\"__quit\":{\"at\":5,\"items\":[]}}";
			var r = JsonNode.Parse(PreferencesGuard.Merge(stored, "{\"__seasonalAt\":2,\"theme\":\"x\"}"))!.AsObject();
			Assert.Equal(5, r["__quit"]!["at"]!.GetValue<double>());
		}

		[Fact]
		public void Kullanici_kapatinca_yedek_silinir()
		{
			const string stored = "{\"__seasonalAt\":1,\"__budget\":{\"at\":5}}";
			var r = JsonNode.Parse(PreferencesGuard.Merge(stored, "{\"__seasonalAt\":2,\"__budget\":null}"))!.AsObject();
			Assert.Null(r["__budget"]);
		}

		[Fact]
		public void Eski_yedek_yenisini_ezemez_yenisi_gecer()
		{
			const string stored = "{\"__seasonalAt\":1,\"__budget\":{\"at\":5,\"v\":\"yeni\"}}";
			var stale = JsonNode.Parse(PreferencesGuard.Merge(stored, "{\"__seasonalAt\":2,\"__budget\":{\"at\":3,\"v\":\"eski\"}}"))!.AsObject();
			Assert.Equal("yeni", stale["__budget"]!["v"]!.GetValue<string>());
			var fresh = JsonNode.Parse(PreferencesGuard.Merge(stored, "{\"__seasonalAt\":2,\"__budget\":{\"at\":9,\"v\":\"son\"}}"))!.AsObject();
			Assert.Equal("son", fresh["__budget"]!["v"]!.GetValue<string>());
		}

		[Fact]
		public void Bozuk_gelen_yazi_oldugu_gibi_kalir()
		{
			Assert.Equal("bozuk{", PreferencesGuard.Merge(Stored, "bozuk{"));
		}
	}
}
