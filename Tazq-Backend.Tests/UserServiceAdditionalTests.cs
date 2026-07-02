using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Microsoft.Extensions.Logging;
using Moq;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    public class UserServiceAdditionalTests
    {
        private readonly AppDbContext _context;
        private readonly Mock<ICustomEmailService> _emailMock;
        private readonly Mock<IJwtService> _jwtMock;
        private readonly Mock<ILogger<UserService>> _loggerMock;
        private readonly Mock<IGoogleTokenValidator> _googleMock;
        private readonly Mock<IAppleTokenValidator> _appleMock;
        private readonly UserService _userService;

        public UserServiceAdditionalTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new AppDbContext(options);
            _emailMock = new Mock<ICustomEmailService>();
            _jwtMock = new Mock<IJwtService>();
            _loggerMock = new Mock<ILogger<UserService>>();
            _googleMock = new Mock<IGoogleTokenValidator>();
            _appleMock = new Mock<IAppleTokenValidator>();
            _userService = new UserService(_context, _emailMock.Object, _jwtMock.Object, _loggerMock.Object, _googleMock.Object, _appleMock.Object);
        }

        [Fact]
        public async Task RegisterAsync_ShouldFail_WhenEmailAlreadyExists()
        {
            var dto = new UserRegisterDto { Email = "dup@test.com", Name = "User", Password = "Pass123!" };
            await _userService.RegisterAsync(dto);

            var result = await _userService.RegisterAsync(dto);

            Assert.False(result);
            Assert.Equal(1, _context.Users.Count(u => u.Email == dto.Email));
        }

        [Fact]
        public async Task LoginAsync_ShouldReturnNull_WhenUserDoesNotExist()
        {
            var result = await _userService.LoginAsync(new UserLoginDto { Email = "ghost@test.com", Password = "x" }, null);
            Assert.Null(result);
        }

        [Fact]
        public async Task LoginAsync_ShouldReturnNull_WhenPasswordIsWrong()
        {
            var dto = new UserRegisterDto { Email = "user@test.com", Name = "User", Password = "Correct!1" };
            await _userService.RegisterAsync(dto);

            var result = await _userService.LoginAsync(new UserLoginDto { Email = dto.Email, Password = "Wrong!1" }, null);
            Assert.Null(result);
        }

        [Fact]
        public async Task GetUserByIdAsync_ShouldReturnUser_WhenExists()
        {
            var dto = new UserRegisterDto { Email = "get@test.com", Name = "GetUser", Password = "Pass!1" };
            await _userService.RegisterAsync(dto);
            var user = await _context.Users.FirstAsync(u => u.Email == dto.Email);

            var result = await _userService.GetUserByIdAsync(user.Id);

            Assert.NotNull(result);
            Assert.Equal(dto.Email, result.Email);
        }

        [Fact]
        public async Task GetUserByIdAsync_ShouldReturnNull_WhenNotExists()
        {
            var result = await _userService.GetUserByIdAsync(99999);
            Assert.Null(result);
        }

        [Fact]
        public async Task DeleteUserAsync_ShouldRemoveUser()
        {
            var dto = new UserRegisterDto { Email = "del@test.com", Name = "DelUser", Password = "Pass!1" };
            await _userService.RegisterAsync(dto);
            var user = await _context.Users.FirstAsync(u => u.Email == dto.Email);

            var result = await _userService.DeleteUserAsync(user.Id);

            Assert.True(result);
            Assert.Null(await _context.Users.FindAsync(user.Id));
        }

        [Fact]
        public async Task DeleteUserAsync_ShouldReturnFalse_WhenUserNotFound()
        {
            var result = await _userService.DeleteUserAsync(99999);
            Assert.False(result);
        }

        [Fact]
        public async Task SendForgotPasswordTokenAsync_ShouldSendEmail_WhenUserExists()
        {
            var dto = new UserRegisterDto { Email = "forgot@test.com", Name = "ForgotUser", Password = "Pass!1" };
            await _userService.RegisterAsync(dto);
            _emailMock.Setup(e => e.SendForgotPasswordEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            var result = await _userService.SendForgotPasswordTokenAsync(dto.Email);

            Assert.True(result);
            await Task.Delay(100); // Give Task.Run a moment to execute background thread
            _emailMock.Verify(e => e.SendForgotPasswordEmailAsync(dto.Email, It.IsAny<string>(), It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task SendForgotPasswordTokenAsync_ShouldReturnFalse_WhenUserNotFound()
        {
            var result = await _userService.SendForgotPasswordTokenAsync("nobody@test.com");
            Assert.False(result);
            _emailMock.Verify(e => e.SendForgotPasswordEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task ResetPasswordAsync_ShouldUpdatePassword_WhenTokenIsValid()
        {
            var dto = new UserRegisterDto { Email = "reset@test.com", Name = "Resetter", Password = "OldPass!1" };
            await _userService.RegisterAsync(dto);
            var user = await _context.Users.FirstAsync(u => u.Email == dto.Email);

            var token = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64));
            using var sha256 = System.Security.Cryptography.SHA256.Create();
            var tokenHash = Convert.ToBase64String(sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(token)));
            _context.PasswordResetTokens.Add(new PasswordResetToken
            {
                UserId = user.Id,
                Token = tokenHash,
                Expiration = DateTime.UtcNow.AddHours(1)
            });
            await _context.SaveChangesAsync();

            var oldPasswordHash = user.PasswordHash;
            var result = await _userService.ResetPasswordAsync(token, "NewPass!1");

            Assert.True(result);
            var updatedUser = await _context.Users.FindAsync(user.Id);
            Assert.NotEqual(oldPasswordHash, updatedUser!.PasswordHash);
        }

        [Fact]
        public async Task ResetPasswordAsync_ShouldFail_WhenTokenIsExpired()
        {
            var dto = new UserRegisterDto { Email = "expired@test.com", Name = "Expired", Password = "Pass!1" };
            await _userService.RegisterAsync(dto);
            var user = await _context.Users.FirstAsync(u => u.Email == dto.Email);

            var token = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64));
            _context.PasswordResetTokens.Add(new PasswordResetToken
            {
                UserId = user.Id,
                Token = token,
                Expiration = DateTime.UtcNow.AddHours(-1)
            });
            await _context.SaveChangesAsync();

            var result = await _userService.ResetPasswordAsync(token, "NewPass!1");

            Assert.False(result);
        }

        [Fact]
        public async Task RotateRefreshTokenAsync_ShouldRevokeAllUserTokens_WhenTokenIsReused()
        {
            // Arrange
            var dto = new UserRegisterDto { Email = "reuse@test.com", Name = "ReuseUser", Password = "Pass!1" };
            await _userService.RegisterAsync(dto);
            var user = await _context.Users.FirstAsync(u => u.Email == dto.Email);

            // Create a revoked token and two active tokens
            var reusedTokenStr = "reused-token-value";
            using var sha = System.Security.Cryptography.SHA256.Create();
            var reusedTokenHash = Convert.ToHexString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(reusedTokenStr)));

            var token1 = new RefreshToken { UserId = user.Id, TokenHash = reusedTokenHash, ExpiresAt = DateTime.UtcNow.AddDays(7), RevokedAt = DateTime.UtcNow.AddHours(-1) };
            var token2 = new RefreshToken { UserId = user.Id, TokenHash = "active-hash-1", ExpiresAt = DateTime.UtcNow.AddDays(7) };
            var token3 = new RefreshToken { UserId = user.Id, TokenHash = "active-hash-2", ExpiresAt = DateTime.UtcNow.AddDays(7) };

            _context.RefreshTokens.AddRange(token1, token2, token3);
            await _context.SaveChangesAsync();

            var result = await _userService.RotateRefreshTokenAsync(reusedTokenStr);

            // Assert
            Assert.Null(result); // Rotation should fail
            
            // All active tokens should now be revoked
            var revokedTokens = await _context.RefreshTokens.Where(t => t.UserId == user.Id).ToListAsync();
            Assert.All(revokedTokens, t => Assert.NotNull(t.RevokedAt));
        }

        [Fact]
        public async Task GoogleLoginAsync_ShouldRegisterAndLoginNewUser_WhenTokenIsValid()
        {
            // Arrange
            var payload = new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Email = "new_google@test.com",
                Name = "Google User"
            };
            _googleMock.Setup(g => g.ValidateAsync("valid-token"))
                .ReturnsAsync(payload);
            _jwtMock.Setup(j => j.GenerateToken(It.IsAny<string>(), It.IsAny<string>()))
                .Returns("jwt-token");

            // Act
            var tokens = await _userService.GoogleLoginAsync("valid-token", "127.0.0.1");

            // Assert
            Assert.NotNull(tokens);
            Assert.Equal("jwt-token", tokens!.Token);

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == payload.Email);
            Assert.NotNull(user);
            Assert.Equal(payload.Name, user!.Name);
            Assert.True(string.IsNullOrEmpty(user.PasswordHash)); // Password auth should be empty
        }

        [Fact]
        public async Task GoogleLoginAsync_ShouldLoginExistingUser_WhenTokenIsValid()
        {
            // Arrange
            var dto = new UserRegisterDto { Email = "exist_google@test.com", Name = "Existing", Password = "Pass123!" };
            await _userService.RegisterAsync(dto);

            var payload = new Google.Apis.Auth.GoogleJsonWebSignature.Payload
            {
                Email = dto.Email,
                Name = dto.Name
            };
            _googleMock.Setup(g => g.ValidateAsync("valid-token"))
                .ReturnsAsync(payload);
            _jwtMock.Setup(j => j.GenerateToken(It.IsAny<string>(), It.IsAny<string>()))
                .Returns("jwt-token");

            // Act
            var tokens = await _userService.GoogleLoginAsync("valid-token", "127.0.0.1");

            // Assert
            Assert.NotNull(tokens);
            Assert.Equal("jwt-token", tokens!.Token);
        }

        [Fact]
        public async Task AppleLoginAsync_ShouldRegisterAndLoginNewUser_WhenTokenIsValid()
        {
            // Arrange
            var claims = new[]
            {
                new Claim("email", "new_apple@test.com"),
                new Claim(ClaimTypes.NameIdentifier, "apple-sub-123")
            };
            var identity = new ClaimsIdentity(claims, "TestAuthType");
            var principal = new ClaimsPrincipal(identity);

            var dto = new AppleLoginDto
            {
                IdentityToken = "valid-apple-token",
                FirstName = "Apple",
                LastName = "User"
            };

            _appleMock.Setup(a => a.ValidateAsync("valid-apple-token"))
                .ReturnsAsync(principal);
            _jwtMock.Setup(j => j.GenerateToken(It.IsAny<string>(), It.IsAny<string>()))
                .Returns("jwt-token");

            // Act
            var tokens = await _userService.AppleLoginAsync(dto, "127.0.0.1");

            // Assert
            Assert.NotNull(tokens);
            Assert.Equal("jwt-token", tokens!.Token);

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == "new_apple@test.com");
            Assert.NotNull(user);
            Assert.Equal("Apple User", user!.Name);
            Assert.True(string.IsNullOrEmpty(user.PasswordHash));
        }

        [Fact]
        public async Task AppleLoginAsync_ShouldLoginExistingUser_WhenTokenIsValid()
        {
            // Arrange
            var existingDto = new UserRegisterDto { Email = "exist_apple@test.com", Name = "Existing", Password = "Pass123!" };
            await _userService.RegisterAsync(existingDto);

            var claims = new[]
            {
                new Claim("email", "exist_apple@test.com"),
                new Claim(ClaimTypes.NameIdentifier, "apple-sub-456")
            };
            var identity = new ClaimsIdentity(claims, "TestAuthType");
            var principal = new ClaimsPrincipal(identity);

            var dto = new AppleLoginDto
            {
                IdentityToken = "valid-apple-token"
            };

            _appleMock.Setup(a => a.ValidateAsync("valid-apple-token"))
                .ReturnsAsync(principal);
            _jwtMock.Setup(j => j.GenerateToken(It.IsAny<string>(), It.IsAny<string>()))
                .Returns("jwt-token");

            // Act
            var tokens = await _userService.AppleLoginAsync(dto, "127.0.0.1");

            // Assert
            Assert.NotNull(tokens);
            Assert.Equal("jwt-token", tokens!.Token);
        }
    }
}
