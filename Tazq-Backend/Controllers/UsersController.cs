using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

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
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var success = await _userService.RegisterAsync(userDto);
            return success ? Ok("Kullanıcı başarıyla kaydedildi.") : BadRequest("E-posta adresi zaten kullanımda.");
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] UserLoginDto userDto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var token = await _userService.LoginAsync(userDto, HttpContext.Connection.RemoteIpAddress?.ToString());
            return token != null ? Ok(new { token }) : Unauthorized("Geçersiz e-posta veya şifre.");
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

        [HttpPost("upload-profile-picture")]
        [Authorize]
        public async Task<IActionResult> UploadProfilePicture([FromForm] IFormFile file)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();

            var url = await _userService.UploadProfilePictureAsync(userId.Value, file);
            return url != null ? Ok(new { message = "Profile picture uploaded.", url }) : BadRequest("Upload failed.");
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

        [HttpPost("refresh-session")]
        [AllowAnonymous]
        public async Task<IActionResult> RefreshSession()
        {
            var tokenHeader = Request.Headers["Authorization"].ToString();
            if (string.IsNullOrEmpty(tokenHeader) || !tokenHeader.StartsWith("Bearer ")) return Unauthorized();

            var tokenString = tokenHeader.Substring("Bearer ".Length);
            var newToken = await _userService.RefreshSessionAsync(tokenString, HttpContext.Connection.RemoteIpAddress?.ToString());

            return newToken != null ? Ok(new { token = newToken }) : Unauthorized("Oturum yenilenemedi.");
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

        public class ForgotPasswordRequest { public string Email { get; set; } = string.Empty; }
        public class ResetPasswordRequest { public string Token { get; set; } = string.Empty; public string NewPassword { get; set; } = string.Empty; }
    }