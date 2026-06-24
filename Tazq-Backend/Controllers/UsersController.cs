using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
    [Route("api/users")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly IUserService _userService;

        public UsersController(IUserService userService)
        {
            _userService = userService;
        }

        [HttpPost("register")]
        [AllowAnonymous]
        public async Task<IActionResult> Register([FromBody] UserRegisterDto userDto)
        {


            var success = await _userService.RegisterAsync(userDto);
            return success ? Ok("Kullanıcı başarıyla kaydedildi.") : BadRequest("E-posta adresi zaten kullanımda.");
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] UserLoginDto userDto)
        {


            var tokens = await _userService.LoginAsync(userDto, HttpContext.Connection.RemoteIpAddress?.ToString());
            return tokens != null
                ? Ok(new { token = tokens.Token, refreshToken = tokens.RefreshToken })
                : Unauthorized("Geçersiz e-posta veya şifre.");
        }

        [HttpPatch("update-notification-preferences")]
        [Authorize]
        public async Task<IActionResult> UpdateNotificationPreferences([FromBody] UserNotificationPreferences preferencesDto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var success = await _userService.UpdateNotificationPreferencesAsync(userId.Value, preferencesDto);
            return success ? Ok("Notification preferences updated.") : NotFound();
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> GetCurrentUser()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var user = await _userService.GetUserByIdAsync(userId.Value);
            if (user == null) return NotFound();

            return Ok(new
            {
                user.Id,
                user.Name,
                user.Email,
                user.Role,
                user.PhoneNumber,
                user.IsPhoneVerified,
                ProfilePicture = user.ProfilePicture ?? "/default-profile.png",
                user.Motto,
                user.AvatarBorderColor,
                user.Preferences,
                NotificationPreferences = user.NotificationPreferences
            });
        }

        [HttpPost("forgot-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            await _userService.SendForgotPasswordTokenAsync(request.Email);
            return Ok("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
        }

        [HttpPost("reset-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var success = await _userService.ResetPasswordAsync(request.Token, request.NewPassword);
            return success ? Ok("Şifreniz başarıyla güncellendi.") : BadRequest("Geçersiz veya süresi dolmuş bağlantı.");
        }

        [HttpPost("refresh")]
        [AllowAnonymous]
        public async Task<IActionResult> Refresh([FromBody] RefreshRequest request)
        {
            var tokens = await _userService.RotateRefreshTokenAsync(request.RefreshToken);
            return tokens != null
                ? Ok(new { token = tokens.Token, refreshToken = tokens.RefreshToken })
                : Unauthorized("Oturum yenilenemedi.");
        }

        [HttpPost("logout")]
        [AllowAnonymous]
        public async Task<IActionResult> Logout([FromBody] RefreshRequest request)
        {
            await _userService.RevokeRefreshTokenAsync(request.RefreshToken);
            return Ok();
        }

        [HttpPut("profile")]
        [Authorize]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var success = await _userService.UpdateProfileAsync(userId.Value, dto.Name, dto.Avatar, dto.Motto, dto.AvatarBorderColor, dto.Preferences);
            return success ? Ok("Profile updated.") : NotFound();
        }

        [HttpDelete("me")]
        [Authorize]
        public async Task<IActionResult> DeleteMe()
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var success = await _userService.DeleteUserAsync(userId.Value);
            return success ? Ok("Hesabınız silindi.") : NotFound();
        }

        private int? GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(userIdClaim, out int userId) ? userId : null;
        }

        public class ForgotPasswordRequest
        {
            [Required]
            [EmailAddress]
            public string Email { get; set; } = string.Empty;
        }
        public class ResetPasswordRequest { public string Token { get; set; } = string.Empty; public string NewPassword { get; set; } = string.Empty; }
        public class RefreshRequest { public string RefreshToken { get; set; } = string.Empty; }
        public class UpdateProfileDto { public string? Name { get; set; } public string? Avatar { get; set; } public string? Motto { get; set; } public string? AvatarBorderColor { get; set; } public string? Preferences { get; set; } }
    }
}