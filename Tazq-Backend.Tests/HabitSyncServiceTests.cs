using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// ALIŞKANLIK EŞİTLEMESİ (2026-10-25). Alışkanlıklar ve serileri yalnız cihazda tutuluyordu:
    /// çıkış yapan ya da telefon değiştiren kullanıcı bütün serilerini kaybediyordu. Gizlilik
    /// metni alışkanlıkları zaten "toplanan veriler" arasında sayıyor; sunucuda görev içerikleri
    /// gibi kullanıcı anahtarıyla ŞİFRELİ saklanır.
    /// </summary>
    public class HabitSyncServiceTests
    {
        private readonly AppDbContext _context;
        private readonly CryptoService _crypto;
        private readonly HabitSyncService _service;

        public HabitSyncServiceTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new AppDbContext(options);
            _crypto = new CryptoService("test-secret-key-1234567890123456");
            _service = new HabitSyncService(_context, _crypto, NullLogger<HabitSyncService>.Instance);
            _context.Users.Add(new User { Id = 1, Email = "a@b.c", Name = "A", PasswordHash = "x" });
            _context.SaveChanges();
        }

        private const string Sample = "[{\"id\":\"h1\",\"name\":\"Kitap oku\",\"completedDates\":[\"2026-10-25\"]}]";

        [Fact]
        public async Task Save_then_Get_roundtrips_the_json()
        {
            Assert.True(await _service.SaveAsync(1, Sample));
            var got = await _service.GetAsync(1);
            Assert.NotNull(got);
            Assert.Equal(Sample, got!.Data);
            Assert.NotNull(got.UpdatedAt);
        }

        [Fact]
        public async Task Stored_value_is_encrypted_at_rest()
        {
            await _service.SaveAsync(1, Sample);
            var raw = (await _context.Users.FindAsync(1))!.HabitsData;
            Assert.NotNull(raw);
            Assert.DoesNotContain("Kitap oku", raw);
        }

        [Fact]
        public async Task Get_for_user_without_data_returns_null_data()
        {
            var got = await _service.GetAsync(1);
            Assert.NotNull(got);
            Assert.Null(got!.Data);
        }

        [Fact]
        public async Task Get_for_unknown_user_returns_null()
        {
            Assert.Null(await _service.GetAsync(999));
        }

        [Fact]
        public async Task Save_for_unknown_user_fails()
        {
            Assert.False(await _service.SaveAsync(999, Sample));
        }

        [Fact]
        public async Task Undecryptable_value_is_reported_as_no_data_not_an_exception()
        {
            var user = await _context.Users.FindAsync(1);
            user!.HabitsData = "bm90LWEtcmVhbC1jaXBoZXItdGV4dC1hdC1hbGwtMTIzNDU2Nzg5MA==";
            await _context.SaveChangesAsync();
            var got = await _service.GetAsync(1);
            Assert.NotNull(got);
            Assert.Null(got!.Data);
        }

        [Theory]
        [InlineData("[]", true)]
        [InlineData("[{\"id\":\"x\"}]", true)]
        [InlineData("{\"id\":\"x\"}", false)]   // dizi değil
        [InlineData("not json", false)]
        [InlineData("", false)]
        public void IsValidPayload_accepts_only_json_arrays(string payload, bool expected)
        {
            Assert.Equal(expected, HabitSyncService.IsValidPayload(payload));
        }
    }
}
