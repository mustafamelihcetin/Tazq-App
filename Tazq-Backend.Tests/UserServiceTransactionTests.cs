using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;
using Tazq_Backend.Tests.TestHelpers;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// RegisterAsync'in atomikliğini GERÇEK bir ilişkisel veritabanında doğrular.
    ///
    /// Neden ayrı bir dosya: diğer testler EF'in InMemory sağlayıcısını kullanıyor ve o
    /// sağlayıcı transaction'ı modelleyemez — BeginTransaction orada sessizce no-op olur.
    /// Yani "grace süresi dolmuş hesabı sil + yenisini oluştur" adımının gerçekten tek
    /// parça olduğu InMemory ile KANITLANAMAZ. SQLite ilişkiseldir ve transaction'ı
    /// gerçekten uygular, bu yüzden geri alma (rollback) burada test edilebilir.
    /// </summary>
    public class UserServiceTransactionTests : IDisposable
    {
        private readonly SqliteConnection _connection;
        private readonly AppDbContext _context;
        private readonly Mock<ICustomEmailService> _emailMock = new();
        private readonly Mock<IJwtService> _jwtMock = new();
        private readonly UserService _userService;

        public UserServiceTransactionTests()
        {
            // In-memory SQLite yalnız bağlantı açık kaldığı sürece yaşar.
            _connection = new SqliteConnection("DataSource=:memory:");
            _connection.Open();

            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(_connection)
                .Options;
            _context = new AppDbContext(options);
            _context.Database.EnsureCreated();

            _userService = new UserService(
                _context, _emailMock.Object, _jwtMock.Object,
                new Mock<ILogger<UserService>>().Object,
                new Mock<IGoogleTokenValidator>().Object,
                new Mock<IAppleTokenValidator>().Object,
                new InlineBackgroundTaskQueue(_emailMock.Object));
        }

        public void Dispose()
        {
            _context.Dispose();
            _connection.Dispose();
        }

        private async Task<User> SeedExpiredDeletedUserAsync(string email)
        {
            var user = new User
            {
                Email = email,
                Name = "Eski Kullanıcı",
                Role = "User",
                PasswordHash = "hash",
                PasswordSalt = "salt",
                // Grace süresi dolmuş → aynı e-postayla yeni kayda izin verilmeli.
                DeletedAt = DateTime.UtcNow.AddDays(-365),
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            _context.Entry(user).State = EntityState.Detached;
            return user;
        }

        [Fact]
        public async Task RegisterAsync_ShouldReplaceExpiredAccount_Atomically()
        {
            var old = await SeedExpiredDeletedUserAsync("reuse@test.com");

            var ok = await _userService.RegisterAsync(new UserRegisterDto
            {
                Email = "reuse@test.com",
                Name = "Yeni Kullanıcı",
                Password = "GecerliParola1",
            });

            Assert.True(ok);

            // Tam olarak bir kayıt kalmalı: eski silinmiş, yenisi oluşmuş.
            var all = await _context.Users.IgnoreQueryFilters()
                .Where(u => u.Email == "reuse@test.com").ToListAsync();
            Assert.Single(all);
            Assert.Equal("Yeni Kullanıcı", all[0].Name);
            Assert.NotEqual(old.Id, all[0].Id);
            Assert.Null(all[0].DeletedAt);
        }

        [Fact]
        public async Task RegisterAsync_ShouldNotDeleteOldAccount_WhenInsertFails()
        {
            // BU TESTİN ASIL AMACI: eski kaydın silinmesi ile yenisinin eklenmesi tek
            // transaction'da değilse, araya giren bir hata eski hesabı SİLİP yenisini
            // oluşturmadan bırakır — geri dönüşü olmayan veri kaybı. Transaction varsa
            // hata hâlinde eski hesap yerinde kalmalıdır.
            await SeedExpiredDeletedUserAsync("rollback@test.com");

            // Insert'ü bozmak için NOT NULL bir sütunu ihlal ettir: Name zorunlu.
            var dto = new UserRegisterDto { Email = "rollback@test.com", Name = null!, Password = "GecerliParola1" };

            await Assert.ThrowsAnyAsync<Exception>(() => _userService.RegisterAsync(dto));

            // Kritik iddia: eski hesap hâlâ orada olmalı (rollback çalıştı).
            var survivors = await _context.Users.IgnoreQueryFilters()
                .Where(u => u.Email == "rollback@test.com").ToListAsync();
            Assert.Single(survivors);
            Assert.Equal("Eski Kullanıcı", survivors[0].Name);
        }

        [Fact]
        public async Task RegisterAsync_ShouldRefuse_WhenAccountStillInGracePeriod()
        {
            var user = new User
            {
                Email = "grace@test.com",
                Name = "Grace",
                Role = "User",
                DeletedAt = DateTime.UtcNow.AddDays(-1), // grace içinde
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var ok = await _userService.RegisterAsync(new UserRegisterDto
            {
                Email = "grace@test.com", Name = "Yeni", Password = "GecerliParola1",
            });

            // Grace içindeki hesap giriş yaparak geri getirilir; e-posta kullanımda sayılır.
            Assert.False(ok);
            Assert.Single(await _context.Users.IgnoreQueryFilters().Where(u => u.Email == "grace@test.com").ToListAsync());
        }

        [Fact]
        public async Task RegisterAsync_ShouldPersistCurrentIterationsOnRealDatabase()
        {
            var ok = await _userService.RegisterAsync(new UserRegisterDto
            {
                Email = "iter@test.com", Name = "Iter", Password = "GecerliParola1",
            });

            Assert.True(ok);
            var stored = await _context.Users.FirstAsync(u => u.Email == "iter@test.com");
            // Sütun gerçekten yazılıyor mu (model ↔ şema uyumu).
            Assert.Equal(PasswordHashDefaults.CurrentIterations, stored.PasswordIterations);
            Assert.True(PasswordHasher.Verify("GecerliParola1", stored.PasswordHash!, stored.PasswordSalt!, stored.PasswordIterations));
        }
    }
}
