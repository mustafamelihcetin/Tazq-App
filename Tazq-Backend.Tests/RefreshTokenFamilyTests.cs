using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Moq;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;
using Tazq_Backend.Tests.TestHelpers;
using Xunit;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// HER CİHAZIN KENDİ OTURUMU (2026-11-05). Kayıtla kanıtlandı: iPhone ve iPad aynı hesapta birbirini sırayla dışarı atıyordu.
    /// Bir cihaz iptal edilmiş anahtar sunduğunda sunucu kullanıcının TÜM anahtarlarını kapatıyordu; yeniden giren cihaz öbürünü ölü bırakıyor, döngü sürüyordu.
    /// </summary>
    public class RefreshTokenFamilyTests
    {
        private const string Pass = "Pass!1234";
        private readonly AppDbContext _context;
        private readonly Mock<ICustomEmailService> _emailMock = new();
        private readonly Mock<IJwtService> _jwtMock = new();
        private readonly Mock<ILogger<UserService>> _loggerMock = new();
        private readonly Mock<IGoogleTokenValidator> _googleMock = new();
        private readonly Mock<IAppleTokenValidator> _appleMock = new();
        private readonly UserService _userService;

        public RefreshTokenFamilyTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            _context = new AppDbContext(options);
            _jwtMock.Setup(j => j.GenerateToken(It.IsAny<string>(), It.IsAny<string>())).Returns("jwt");
            _userService = new UserService(_context, _emailMock.Object, _jwtMock.Object, _loggerMock.Object, _googleMock.Object, _appleMock.Object, new InlineBackgroundTaskQueue(_emailMock.Object));
        }

        private async Task<(string a, string b)> TwoDevices(string email)
        {
            await _userService.RegisterAsync(new UserRegisterDto { Email = email, Name = "Iki Cihaz", Password = Pass });
            var a = await _userService.LoginAsync(new UserLoginDto { Email = email, Password = Pass }, null);
            var b = await _userService.LoginAsync(new UserLoginDto { Email = email, Password = Pass }, null);
            return (a!.RefreshToken, b!.RefreshToken);
        }

        /// <summary>Tolerans süresini geçirir: gerçek hayatta eski anahtar dakikalar sonra gelir.</summary>
        private async Task AgeRevocations()
        {
            foreach (var t in await _context.RefreshTokens.Where(x => x.RevokedAt != null).ToListAsync()) t.RevokedAt = DateTime.UtcNow.AddMinutes(-10);
            await _context.SaveChangesAsync();
        }

        [Fact]
        public async Task StaleTokenOnOneDevice_DoesNotLogOutTheOtherDevice()
        {
            var (phone, tablet) = await TwoDevices("iki@test.com");
            Assert.NotNull(await _userService.RotateRefreshTokenAsync(phone));
            await AgeRevocations();

            // Telefon eski anahtarı yeniden sunar.
            Assert.Null(await _userService.RotateRefreshTokenAsync(phone));

            // Tablet bundan etkilenmez. Dakikalar sonra gelir: hemen denese 60 saniyelik tolerans kusuru gizlerdi.
            await AgeRevocations();
            Assert.NotNull(await _userService.RotateRefreshTokenAsync(tablet));
        }

        [Fact]
        public async Task PingPong_TwoDevicesStopThrowingEachOtherOut()
        {
            var (phone, tablet) = await TwoDevices("dongu@test.com");
            Assert.NotNull(await _userService.RotateRefreshTokenAsync(phone));
            var tablet2 = await _userService.RotateRefreshTokenAsync(tablet);
            await AgeRevocations();

            // Telefon eski anahtar sunup çıkış yer, yeniden girer.
            Assert.Null(await _userService.RotateRefreshTokenAsync(phone));
            var phoneAgain = await _userService.LoginAsync(new UserLoginDto { Email = "dongu@test.com", Password = Pass }, null);
            await AgeRevocations();

            // Tablet çalışmaya devam eder, telefonun yeni oturumu da.
            Assert.NotNull(await _userService.RotateRefreshTokenAsync(tablet2!.RefreshToken));
            await AgeRevocations();
            Assert.NotNull(await _userService.RotateRefreshTokenAsync(phoneAgain!.RefreshToken));
        }

        [Fact]
        public async Task ReusedToken_ClosesItsOwnChain_StolenCopyDies()
        {
            var (phone, _) = await TwoDevices("calinti@test.com");
            var phone2 = await _userService.RotateRefreshTokenAsync(phone);
            await AgeRevocations();

            // Eski anahtar yeniden sunulunca zincirin güncel halkası da kapanır: çalan da sahibi de yeniden giriş yapar.
            Assert.Null(await _userService.RotateRefreshTokenAsync(phone));
            await AgeRevocations();
            Assert.Null(await _userService.RotateRefreshTokenAsync(phone2!.RefreshToken));
        }

        [Fact]
        public async Task EveryLoginStartsAFamily_RotationKeepsIt()
        {
            var (phone, _) = await TwoDevices("aile@test.com");
            Assert.NotNull(await _userService.RotateRefreshTokenAsync(phone));
            var families = await _context.RefreshTokens.Select(t => t.FamilyId).ToListAsync();
            Assert.DoesNotContain(null, families);
            Assert.Equal(1, families.GroupBy(f => f).Count(g => g.Count() == 2)); // telefonun iki halkası aynı aile
        }

        [Fact]
        public async Task LateRetryWithinGrace_StaysInTheSameFamily()
        {
            var (phone, _) = await TwoDevices("tolerans@test.com");
            Assert.NotNull(await _userService.RotateRefreshTokenAsync(phone));
            Assert.NotNull(await _userService.RotateRefreshTokenAsync(phone)); // yanıtı kaybolan istek hemen yinelenir
            var biggest = (await _context.RefreshTokens.Select(t => t.FamilyId).ToListAsync()).GroupBy(f => f).Max(g => g.Count());
            Assert.Equal(3, biggest);
        }

        private async Task AddLegacyToken(int userId, string raw, DateTime? revokedAt)
        {
            using var sha = System.Security.Cryptography.SHA256.Create();
            _context.RefreshTokens.Add(new RefreshToken { UserId = userId, TokenHash = Convert.ToHexString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(raw))), ExpiresAt = DateTime.UtcNow.AddDays(7), RevokedAt = revokedAt });
            await _context.SaveChangesAsync();
        }

        [Fact]
        public async Task LegacyRevokedTokenWithoutFamily_IsRejectedAlone()
        {
            var (_, tablet) = await TwoDevices("eski@test.com");
            var user = await _context.Users.FirstAsync(u => u.Email == "eski@test.com");
            await AddLegacyToken(user.Id, "eski-anahtar", DateTime.UtcNow.AddHours(-1));

            Assert.Null(await _userService.RotateRefreshTokenAsync("eski-anahtar"));
            Assert.NotNull(await _userService.RotateRefreshTokenAsync(tablet));
        }

        [Fact]
        public async Task LegacyActiveToken_KeepsWorkingAndGetsAFamily()
        {
            await _userService.RegisterAsync(new UserRegisterDto { Email = "gecis@test.com", Name = "Gecis", Password = Pass });
            var user = await _context.Users.FirstAsync(u => u.Email == "gecis@test.com");
            await AddLegacyToken(user.Id, "gecis-anahtar", null);

            // Güncelleme anında açık olan oturum kapanmaz.
            var next = await _userService.RotateRefreshTokenAsync("gecis-anahtar");
            Assert.NotNull(next);
            await AgeRevocations();
            Assert.NotNull(await _userService.RotateRefreshTokenAsync(next!.RefreshToken));
            Assert.NotNull((await _context.RefreshTokens.OrderByDescending(t => t.Id).FirstAsync()).FamilyId);
        }

        [Fact]
        public async Task PasswordChange_ClosesEveryDevice()
        {
            var (phone, tablet) = await TwoDevices("parola@test.com");
            var user = await _context.Users.FirstAsync(u => u.Email == "parola@test.com");
            Assert.Equal(0, await _userService.ChangePasswordAsync(user.Id, Pass, "YeniParola!1234"));
            await AgeRevocations();
            Assert.Null(await _userService.RotateRefreshTokenAsync(phone));
            Assert.Null(await _userService.RotateRefreshTokenAsync(tablet));
        }
    }
}
