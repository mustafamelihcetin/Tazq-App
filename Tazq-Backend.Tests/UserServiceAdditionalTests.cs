using Microsoft.EntityFrameworkCore;
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
        private readonly UserService _userService;

        public UserServiceAdditionalTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new AppDbContext(options);
            _emailMock = new Mock<ICustomEmailService>();
            _jwtMock = new Mock<IJwtService>();
            _userService = new UserService(_context, _emailMock.Object, _jwtMock.Object);
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
            _emailMock.Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            var result = await _userService.SendForgotPasswordTokenAsync(dto.Email);

            Assert.True(result);
            _emailMock.Verify(e => e.SendEmailAsync(dto.Email, It.IsAny<string>(), It.IsAny<string>()), Times.Once);
        }

        [Fact]
        public async Task SendForgotPasswordTokenAsync_ShouldReturnTrue_WhenUserNotFound()
        {
            var result = await _userService.SendForgotPasswordTokenAsync("nobody@test.com");
            Assert.True(result);
            _emailMock.Verify(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task ResetPasswordAsync_ShouldUpdatePassword_WhenTokenIsValid()
        {
            var dto = new UserRegisterDto { Email = "reset@test.com", Name = "Resetter", Password = "OldPass!1" };
            await _userService.RegisterAsync(dto);
            var user = await _context.Users.FirstAsync(u => u.Email == dto.Email);

            var token = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(64));
            _context.PasswordResetTokens.Add(new PasswordResetToken
            {
                UserId = user.Id,
                Token = token,
                Expiration = DateTime.UtcNow.AddHours(1)
            });
            await _context.SaveChangesAsync();

            var result = await _userService.ResetPasswordAsync(token, "NewPass!1");

            Assert.True(result);
            var updatedUser = await _context.Users.FindAsync(user.Id);
            Assert.NotEqual(user.PasswordHash, updatedUser!.PasswordHash);
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
    }
}
