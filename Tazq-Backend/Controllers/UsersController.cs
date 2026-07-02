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
            // Yapısal hata kodu: istemci sunucu mesaj metnine bağımlı kalmasın.
            return success
                ? Ok("Kullanıcı başarıyla kaydedildi.")
                : BadRequest(new { error = "email_taken", message = "E-posta adresi zaten kullanımda." });
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

        [HttpPost("google-login")]
        [AllowAnonymous]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.IdToken))
                return BadRequest(new { message = "Google Token bulunamadı." });

            var tokens = await _userService.GoogleLoginAsync(dto.IdToken, HttpContext.Connection.RemoteIpAddress?.ToString());
            return tokens != null
                ? Ok(new { token = tokens.Token, refreshToken = tokens.RefreshToken })
                : BadRequest(new { message = "Google doğrulaması başarısız oldu veya hesap engellendi." });
        }

        [HttpPost("apple-login")]
        [AllowAnonymous]
        public async Task<IActionResult> AppleLogin([FromBody] AppleLoginDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.IdentityToken))
                return BadRequest(new { message = "Apple Identity Token bulunamadı." });

            var tokens = await _userService.AppleLoginAsync(dto, HttpContext.Connection.RemoteIpAddress?.ToString());
            return tokens != null
                ? Ok(new { token = tokens.Token, refreshToken = tokens.RefreshToken })
                : BadRequest(new { message = "Apple doğrulaması başarısız oldu veya hesap engellendi." });
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

            var success = await _userService.SendForgotPasswordTokenAsync(request.Email);
            if (!success)
            {
                return BadRequest(new { message = "Bu e-posta adresiyle kayıtlı bir hesap bulunamadı." });
            }
            return Ok("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
        }

        [HttpGet("reset-password-form")]
        [AllowAnonymous]
        public IActionResult ResetPasswordForm([FromQuery] string token)
        {
            var html = @"<!DOCTYPE html>
<html lang=""tr"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Şifre Sıfırlama | TAZQ</title>
    <link href=""https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"" rel=""stylesheet"">
    <style>
        :root {
            --bg-color: #0d0e12;
            --surface-color: rgba(255, 255, 255, 0.03);
            --border-color: rgba(255, 255, 255, 0.08);
            --primary-color: #6366f1;
            --primary-hover: #4f46e5;
            --text-color: #f8fafc;
            --text-muted: #94a3b8;
            --error-color: #ef4444;
            --success-color: #10b981;
        }
        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .container {
            width: 100%;
            max-width: 420px;
            padding: 24px;
            box-sizing: border-box;
        }
        .logo {
            text-align: center;
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -1px;
            margin-bottom: 24px;
            background: linear-gradient(135deg, #a5b4fc, #6366f1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .card {
            background-color: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 32px 24px;
            backdrop-filter: blur(20px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }
        h2 {
            font-size: 22px;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }
        p {
            font-size: 14px;
            color: var(--text-muted);
            margin-top: 0;
            margin-bottom: 24px;
            line-height: 1.5;
        }
        .form-group {
            margin-bottom: 20px;
            position: relative;
        }
        label {
            display: block;
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 6px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        input {
            width: 100%;
            padding: 14px 16px;
            box-sizing: border-box;
            background-color: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            color: var(--text-color);
            font-family: inherit;
            font-size: 15px;
            font-weight: 600;
            transition: all 0.2s ease;
        }
        input:focus {
            outline: none;
            border-color: var(--primary-color);
            background-color: rgba(255, 255, 255, 0.05);
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
        }
        button {
            width: 100%;
            padding: 14px;
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: 12px;
            font-family: inherit;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-top: 8px;
        }
        button:hover {
            background-color: var(--primary-hover);
        }
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .banner {
            display: none;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 20px;
            line-height: 1.4;
        }
        .banner-error {
            background-color: rgba(239, 68, 68, 0.1);
            color: var(--error-color);
            border: 1px solid rgba(239, 68, 68, 0.15);
        }
        .banner-success {
            background-color: rgba(16, 185, 129, 0.1);
            color: var(--success-color);
            border: 1px solid rgba(16, 185, 129, 0.15);
        }
        .success-screen {
            display: none;
            text-align: center;
        }
        .success-icon {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background-color: rgba(16, 185, 129, 0.1);
            color: var(--success-color);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            margin: 0 auto 20px auto;
        }
    </style>
</head>
<body>
    <div class=""container"">
        <div class=""logo"">TAZQ</div>
        
        <div class=""card"" id=""formCard"">
            <div class=""banner banner-error"" id=""errorBanner""></div>
            
            <h2>Şifre Sıfırlama</h2>
            <p>TAZQ hesabınız için yeni bir şifre belirleyin. Bu bağlantı güvenlik nedeniyle 1 saat geçerlidir.</p>
            
            <form id=""resetForm"">
                <div class=""form-group"">
                    <label for=""password"">Yeni Şifre</label>
                    <input type=""password"" id=""password"" required minlength=""6"" placeholder=""••••••••"">
                </div>
                
                <div class=""form-group"">
                    <label for=""confirmPassword"">Yeni Şifre (Tekrar)</label>
                    <input type=""password"" id=""confirmPassword"" required minlength=""6"" placeholder=""••••••••"">
                </div>
                
                <button type=""submit"" id=""submitBtn"">Şifreyi Güncelle</button>
            </form>
        </div>

        <div class=""card success-screen"" id=""successCard"">
            <div class=""success-icon"">✓</div>
            <h2>Şifreniz Güncellendi</h2>
            <p>Şifreniz başarıyla yenilendi. Aşağıdaki butondan doğrudan uygulamaya dönerek yeni şifrenizle giriş yapabilirsiniz.</p>
            <a href=""tazq-app://"" style=""display: block; text-align: center; text-decoration: none; margin-top: 24px; background-color: var(--primary-color); color: white; padding: 14px; border-radius: 12px; font-weight: 700; transition: background-color 0.2s;"">TAZQ Uygulamasını Aç</a>
        </div>
    </div>

    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        const formCard = document.getElementById('formCard');
        const successCard = document.getElementById('successCard');
        const errorBanner = document.getElementById('errorBanner');
        const resetForm = document.getElementById('resetForm');
        const submitBtn = document.getElementById('submitBtn');

        if (!token) {
            showError(""Geçersiz veya eksik güvenlik bağlantısı."");
            submitBtn.disabled = true;
        }

        function showError(msg) {
            errorBanner.innerText = msg;
            errorBanner.style.display = 'block';
        }

        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                showError(""Şifreler birbiriyle eşleşmiyor."");
                return;
            }

            errorBanner.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.innerText = 'Güncelleniyor...';

            try {
                const response = await fetch('/api/users/reset-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ token, newPassword: password })
                });

                if (response.ok) {
                    formCard.style.display = 'none';
                    successCard.style.display = 'block';
                } else {
                    let errorText = ""Bir hata oluştu."";
                    try {
                        const data = await response.json();
                        errorText = data.message || errorText;
                    } catch {
                        const rawText = await response.text();
                        if (rawText) errorText = rawText;
                    }
                    showError(errorText);
                    submitBtn.disabled = false;
                    submitBtn.innerText = 'Şifreyi Güncelle';
                }
            } catch (err) {
                showError(""Sunucuya bağlanılamadı."");
                submitBtn.disabled = false;
                submitBtn.innerText = 'Şifreyi Güncelle';
            }
        });
    </script>
</body>
</html>";
            return Content(html, "text/html", System.Text.Encoding.UTF8);
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