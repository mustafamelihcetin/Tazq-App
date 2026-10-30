using Tazq_App.Services;
using Xunit;

namespace Tazq_Backend.Tests
{
    // Arka plan iş sağlığı: panel "çalışıyor mu, takıldı mı, hata mı veriyor" sorusunu doğru cevaplamalı.
    public class JobHealthTests
    {
        private DateTime _now = new(2026, 10, 31, 12, 0, 0, DateTimeKind.Utc);
        private JobHealth Make() => new(() => _now);
        private static JobHealth.Snapshot Of(JobHealth h, string key) => h.All().Single(j => j.Key == key);

        [Fact]
        public void HenuzCalismamis_BeklemedeSonraGecikiyor()
        {
            var h = Make();
            h.Register(JobHealth.AccountPurge, TimeSpan.FromHours(24));
            Assert.Equal(JobHealth.Status.Waiting, Of(h, JobHealth.AccountPurge).State);
            _now = _now.AddHours(49);
            Assert.Equal(JobHealth.Status.Late, Of(h, JobHealth.AccountPurge).State);
        }

        [Fact]
        public void HataSonrakiBasariliTurdaDuzelir_SayaclarKalir()
        {
            var h = Make();
            h.Register(JobHealth.SignupDigest, TimeSpan.FromMinutes(20));
            h.Fail(JobHealth.SignupDigest, new InvalidOperationException("smtp down\nstack line"));
            var s = Of(h, JobHealth.SignupDigest);
            Assert.Equal(JobHealth.Status.Failing, s.State);
            Assert.Equal("InvalidOperationException: smtp down", s.LastError); // yalnız ilk satır
            _now = _now.AddMinutes(20);
            h.Ok(JobHealth.SignupDigest);
            s = Of(h, JobHealth.SignupDigest);
            Assert.Equal(JobHealth.Status.Ok, s.State);
            Assert.Equal(2, s.Runs);
            Assert.Equal(1, s.Failures);
        }

        [Fact]
        public void IkiTurPayiAsilincaGecikiyor()
        {
            var h = Make();
            h.Register(JobHealth.SignupDigest, TimeSpan.FromMinutes(20));
            h.Ok(JobHealth.SignupDigest);
            _now = _now.AddMinutes(44);
            Assert.Equal(JobHealth.Status.Ok, Of(h, JobHealth.SignupDigest).State);
            _now = _now.AddMinutes(2);
            Assert.Equal(JobHealth.Status.Late, Of(h, JobHealth.SignupDigest).State);
        }

        [Fact]
        public void Kuyruk_OlayGudumlu_AsliGecikmezVeBekleyeniGosterir()
        {
            var h = Make();
            h.Register(JobHealth.MailQueue, TimeSpan.Zero);
            h.TrackPending(() => 3);
            _now = _now.AddDays(10);
            var s = Of(h, JobHealth.MailQueue);
            Assert.Equal(JobHealth.Status.Waiting, s.State);
            Assert.Equal(3, s.Pending);
            Assert.Null(Of(h, JobHealth.MailQueue).LastError);
        }

        [Fact]
        public void UzunHataMesajiKirpilir()
        {
            var h = Make();
            h.Fail("x", new Exception(new string('a', 400)));
            Assert.True(Of(h, "x").LastError!.Length < 200);
        }
    }
}
