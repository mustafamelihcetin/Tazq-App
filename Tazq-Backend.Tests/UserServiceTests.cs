using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

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
                .Options;
            _context = new AppDbContext(options);

            _emailMock = new Mock<ICustomEmailService>();
            _jwtMock = new Mock<IJwtService>();
            _loggerMock = new Mock<ILogger<UserService>>();
            var googleMock = new Mock<IGoogleTokenValidator>();
            var appleMock = new Mock<IAppleTokenValidator>();

            _userService = new UserService(_context, _emailMock.Object, _jwtMock.Object, _loggerMock.Object, googleMock.Object, appleMock.Object);
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

            var loginDto = new UserLoginDto { Email = email, Password = password };
            _jwtMock.Setup(j => j.GenerateToken(It.IsAny<string>(), It.IsAny<string>()))
                .Returns("mock_token");

            // Act
            var token = await _userService.LoginAsync(loginDto, "127.0.0.1");

            // Assert
            Assert.Equal("mock_token", token?.Token);
            Assert.False(string.IsNullOrEmpty(token?.RefreshToken));
        }
    }
}
