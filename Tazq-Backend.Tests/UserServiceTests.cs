using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Moq;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;
using Tazq_Backend.Tests.TestHelpers;

namespace Tazq_Backend.Tests
{
    public class UserServiceTests
    {
        private readonly AppDbContext _context;
        private readonly Mock<ICustomEmailService> _emailMock;
        private readonly Mock<IJwtService> _jwtMock;
        private readonly Mock<ILogger<UserService>> _loggerMock;
        private readonly UserService _userService;

        public UserServiceTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                // InMemory sağlayıcı transaction'ları modelleyemez; uyarı susturulmazsa
                // BeginTransaction çağrısı hata fırlatır (bkz. RegisterAsync).
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            _context = new AppDbContext(options);

            _emailMock = new Mock<ICustomEmailService>();
            _jwtMock = new Mock<IJwtService>();
            _loggerMock = new Mock<ILogger<UserService>>();
            var googleMock = new Mock<IGoogleTokenValidator>();
            var appleMock = new Mock<IAppleTokenValidator>();

            _userService = new UserService(_context, _emailMock.Object, _jwtMock.Object, _loggerMock.Object, googleMock.Object, appleMock.Object, new InlineBackgroundTaskQueue(_emailMock.Object));
        }

        [Fact]
        public async Task RegisterAsync_ShouldCreateUserWithHashedPassword()
        {
            // Arrange
            var userDto = new UserRegisterDto
            {
                Email = "test@example.com",
                Name = "Test User",
                Password = "Password123!"
            };

            // Act
            var result = await _userService.RegisterAsync(userDto);

            // Assert
            Assert.True(result);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == userDto.Email);
            Assert.NotNull(user);
            Assert.NotNull(user.PasswordHash);
            Assert.NotNull(user.PasswordSalt);
            Assert.NotEqual("Password123!", user.PasswordHash);
        }

        [Fact]
        public async Task LoginAsync_ShouldReturnToken_WhenCredentialsAreValid()
        {
            // Arrange
            var email = "login@example.com";
            var password = "SafePassword!";
            var userDto = new UserRegisterDto { Email = email, Name = "LoginUser", Password = password };
            await _userService.RegisterAsync(userDto);

            // Kayıt sonrası hesap doğrulanmamış olur; login doğrulama şartı koşar (bkz. LoginAsync).
            var registered = await _context.Users.FirstAsync(u => u.Email == email);
            registered.IsEmailVerified = true;
            await _context.SaveChangesAsync();

            var loginDto = new UserLoginDto { Email = email, Password = password };
            _jwtMock.Setup(j => j.GenerateToken(It.IsAny<string>(), It.IsAny<string>()))
                .Returns("mock_token");

            // Act
            var token = await _userService.LoginAsync(loginDto, "127.0.0.1");

            // Assert
            Assert.Equal("mock_token", token?.Token);
            Assert.False(string.IsNullOrEmpty(token?.RefreshToken));
        }

        [Fact]
        public async Task LoginAsync_ShouldAcceptLegacyHash_AndSilentlyUpgradeIterations()
        {
            // PasswordIterations sütunundan önce kaydolmuş bir kullanıcıyı taklit eder:
            // hash 100k ile üretilmiş. Bu kullanıcı hem giriş yapabilmeli (yoksa migration
            // mevcut herkesi kilitler) hem de girişte sessizce 600k'ya taşınmalı.
            var email = "legacy@example.com";
            var password = "EskiParola1";
            var salt = System.Security.Cryptography.RandomNumberGenerator.GetBytes(16);
            using var pbkdf2 = new System.Security.Cryptography.Rfc2898DeriveBytes(
                password, salt, PasswordHashDefaults.LegacyIterations, System.Security.Cryptography.HashAlgorithmName.SHA256);

            _context.Users.Add(new User
            {
                Email = email,
                Name = "Legacy User",
                PasswordHash = Convert.ToBase64String(pbkdf2.GetBytes(32)),
                PasswordSalt = Convert.ToBase64String(salt),
                PasswordIterations = PasswordHashDefaults.LegacyIterations,
                Role = "User",
                IsEmailVerified = true,
            });
            await _context.SaveChangesAsync();

            _jwtMock.Setup(j => j.GenerateToken(It.IsAny<string>(), It.IsAny<string>())).Returns("mock_token");

            var token = await _userService.LoginAsync(new UserLoginDto { Email = email, Password = password }, "127.0.0.1");

            Assert.Equal("mock_token", token?.Token);

            // Yükseltme gerçekleşmeli ve yeni hash aynı parolayla doğrulanabilmeli.
            var stored = await _context.Users.FirstAsync(u => u.Email == email);
            Assert.Equal(PasswordHashDefaults.CurrentIterations, stored.PasswordIterations);
            Assert.True(PasswordHasher.Verify(password, stored.PasswordHash!, stored.PasswordSalt!, stored.PasswordIterations));

            // Yükseltme sonrası ikinci giriş de çalışmalı (rehash kendi kaydını bozmasın).
            var second = await _userService.LoginAsync(new UserLoginDto { Email = email, Password = password }, "127.0.0.1");
            Assert.Equal("mock_token", second?.Token);
        }

        [Fact]
        public async Task LoginAsync_ShouldReturnNull_ForWrongPassword()
        {
            var email = "wrongpw@example.com";
            await _userService.RegisterAsync(new UserRegisterDto { Email = email, Name = "U", Password = "DogruParola1" });
            var registered = await _context.Users.FirstAsync(u => u.Email == email);
            registered.IsEmailVerified = true;
            await _context.SaveChangesAsync();

            var token = await _userService.LoginAsync(new UserLoginDto { Email = email, Password = "YanlisParola1" }, "127.0.0.1");

            Assert.Null(token);
        }
    }
}
