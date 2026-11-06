using Tazq_App.Services;
using Xunit;

namespace Tazq_Backend.Tests
{
	public class AbuseGuardTests
	{
		private DateTime _t = new(2026, 11, 6, 12, 0, 0, DateTimeKind.Utc);
		private AbuseGuard New() => new(() => _t);

		[Fact]
		public void Hesap_dakika_siniri_asilinca_reddeder_sonraki_dakika_acilir()
		{
			var g = New();
			for (var i = 0; i < AbuseGuard.AccountPerMinute; i++) Assert.True(g.AllowAccount(1, out _));
			Assert.False(g.AllowAccount(1, out var retry));
			Assert.InRange(retry, 1, 60);
			_t = _t.AddMinutes(1);
			Assert.True(g.AllowAccount(1, out _));
		}

		[Fact]
		public void Hesap_saat_siniri_dakikaya_yayilsa_da_tutar()
		{
			var g = New();
			var denied = false;
			for (var m = 0; m < 59 && !denied; m++)
			{
				for (var i = 0; i < 100; i++) denied |= !g.AllowAccount(1, out _);
				_t = _t.AddMinutes(1);
			}
			Assert.True(denied);
		}

		[Fact]
		public void Bir_hesap_digerini_etkilemez()
		{
			var g = New();
			for (var i = 0; i <= AbuseGuard.AccountPerMinute; i++) g.AllowAccount(1, out _);
			Assert.True(g.AllowAccount(2, out _));
		}

		[Fact]
		public void Israrci_anahtar_gecici_engellenir_sure_bitince_acilir()
		{
			var g = New();
			for (var i = 0; i < AbuseGuard.StrikesToBlock - 1; i++) g.Strike("ip:1.2.3.4");
			Assert.False(g.IsBlocked("ip:1.2.3.4", out _));
			g.Strike("ip:1.2.3.4");
			Assert.True(g.IsBlocked("ip:1.2.3.4", out var retry));
			Assert.InRange(retry, 1, (int)AbuseGuard.BlockFor.TotalSeconds);
			Assert.False(g.IsBlocked("ip:5.6.7.8", out _));
			_t = _t.Add(AbuseGuard.BlockFor).AddSeconds(1);
			Assert.False(g.IsBlocked("ip:1.2.3.4", out _));
		}

		[Fact]
		public void Yavas_gelen_ret_engele_donusmez()
		{
			var g = New();
			for (var i = 0; i < AbuseGuard.StrikesToBlock * 2; i++)
			{
				g.Strike("ip:1.2.3.4");
				_t = _t.AddSeconds(30);
			}
			Assert.False(g.IsBlocked("ip:1.2.3.4", out _));
		}

		[Fact]
		public void Ozet_kim_oldugunu_degil_sayiyi_soyler_ve_bir_saatte_duser()
		{
			var g = New();
			for (var i = 0; i < AbuseGuard.StrikesToBlock; i++) g.Strike("ip:1.2.3.4");
			var s = g.Snapshot();
			Assert.Equal(1, s["blockedNow"]!.GetValue<int>());
			Assert.Equal(1, s["blocksLastHour"]!.GetValue<int>());
			Assert.DoesNotContain("1.2.3.4", s.ToJsonString());
			_t = _t.AddHours(2);
			var later = g.Snapshot();
			Assert.Equal(0, later["blockedNow"]!.GetValue<int>());
			Assert.Equal(0, later["rejectedLastHour"]!.GetValue<int>());
		}
	}
}
