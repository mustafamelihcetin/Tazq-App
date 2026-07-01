using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    public class UserService : IUserService
    {
        private readonly AppDbContext _context;
        private readonly ICustomEmailService _emailService;
        private readonly IJwtService _jwtService;
        private readonly ILogger<UserService> _logger;

        public UserService(AppDbContext context, ICustomEmailService emailService, IJwtService jwtService, ILogger<UserService> logger)
        {
            _context = context;
            _emailService = emailService;
            _jwtService = jwtService;
            _logger = logger;
        }

        public async Task<bool> RegisterAsync(UserRegisterDto userDto)
        {
            if (await _context.Users.AnyAsync(u => u.Email == userDto.Email))
                return false;

            var salt = RandomNumberGenerator.GetBytes(16);
            using var pbkdf2 = new Rfc2898DeriveBytes(userDto.Password, salt, 100000, HashAlgorithmName.SHA256);
            byte[] passwordHash = pbkdf2.GetBytes(32);

            var user = new User
            {
                Name = userDto.Name,
                Email = userDto.Email,
                PasswordHash = Convert.ToBase64String(passwordHash),
                PasswordSalt = Convert.ToBase64String(salt),
                Role = "User"
            };

            _context.Users.Add(user);
            return await _context.SaveChangesAsync() > 0;
        }

        // Refresh token ömrü
        private static readonly TimeSpan RefreshTokenLifetime = TimeSpan.FromDays(60);

        // Ham (istemciye dönen) opak token üretir; DB'ye yalnızca hash'i yazılır.
        private static string GenerateRawRefreshToken() =>
            Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

        private static string HashRefreshToken(string raw)
        {
            using var sha = SHA256.Create();
            return Convert.ToHexString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(raw)));
        }

        private async Task<string> IssueRefreshTokenAsync(int userId)
        {
            var raw = GenerateRawRefreshToken();
            _context.RefreshTokens.Add(new RefreshToken
            {
                UserId = userId,
                TokenHash = HashRefreshToken(raw),
                ExpiresAt = DateTime.UtcNow.Add(RefreshTokenLifetime),
                CreatedAt = DateTime.UtcNow,
            });
            await _context.SaveChangesAsync();
            return raw;
        }

        public async Task<AuthTokens?> LoginAsync(UserLoginDto userDto, string? ipAddress)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == userDto.Email);
            if (user == null || string.IsNullOrEmpty(user.PasswordSalt))
                return null;

            using var pbkdf2 = new Rfc2898DeriveBytes(userDto.Password, Convert.FromBase64String(user.PasswordSalt), 100000, HashAlgorithmName.SHA256);
            var computedHash = Convert.ToBase64String(pbkdf2.GetBytes(32));

            if (computedHash != user.PasswordHash)
                return null;

            // Banlı kullanıcı giriş yapamaz
            if (user.IsBanned)
                return null;

            if (!string.IsNullOrEmpty(ipAddress))
            {
                user.LastLoginIp = ipAddress;
                _context.Users.Update(user);
                await _context.SaveChangesAsync();
            }

            var accessToken = _jwtService.GenerateToken(user.Id.ToString(), user.Role ?? "User");
            var refreshToken = await IssueRefreshTokenAsync(user.Id);
            return new AuthTokens(accessToken, refreshToken);
        }

        public async Task<User?> GetUserByIdAsync(int userId)
        {
            return await _context.Users.AsNoTracking().Include(u => u.NotificationPreferences).FirstOrDefaultAsync(u => u.Id == userId);
        }

        public async Task<bool> UpdateNotificationPreferencesAsync(int userId, UserNotificationPreferences preferences)
        {
            var user = await _context.Users.Include(u => u.NotificationPreferences).FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return false;

            if (user.NotificationPreferences == null)
            {
                preferences.UserId = userId;
                _context.UserNotificationPreferences.Add(preferences);
            }
            else
            {
                user.NotificationPreferences.ReceiveWeeklySummary = preferences.ReceiveWeeklySummary;
                user.NotificationPreferences.ReminderDaysBeforeDue = preferences.ReminderDaysBeforeDue;
                user.NotificationPreferences.WeeklySummaryDay = preferences.WeeklySummaryDay;
                user.NotificationPreferences.NotificationDaysBefore = preferences.NotificationDaysBefore;
                user.NotificationPreferences.NotificationTimeOfDay = preferences.NotificationTimeOfDay;
            }

            return await _context.SaveChangesAsync() > 0;
        }

        public async Task<bool> SendForgotPasswordTokenAsync(string email)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null) return true; // Pretend success for security

            var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            // Store SHA-256 hash; send raw token to user so a DB breach doesn't expose tokens
            using var sha256 = System.Security.Cryptography.SHA256.Create();
            var tokenHash = Convert.ToBase64String(sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(rawToken)));
            var expiration = DateTime.UtcNow.AddHours(1);

            var resetToken = new PasswordResetToken
            {
                UserId = user.Id,
                Token = tokenHash,
                Expiration = expiration
            };

            _context.PasswordResetTokens.Add(resetToken);
            await _context.SaveChangesAsync();

            var mailBody = $"Şifre sıfırlama kodunuz: <b>{rawToken}</b>";
            await _emailService.SendEmailAsync(user.Email, "Şifre Sıfırlama", mailBody);

            return true;
        }

        public async Task<bool> ResetPasswordAsync(string token, string newPassword)
        {
            using var sha256 = System.Security.Cryptography.SHA256.Create();
            var tokenHash = Convert.ToBase64String(sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(token)));
            var tokenEntry = await _context.PasswordResetTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.Token == tokenHash);
            if (tokenEntry == null || tokenEntry.Expiration < DateTime.UtcNow) return false;

            var salt = RandomNumberGenerator.GetBytes(16);
            using var pbkdf2 = new Rfc2898DeriveBytes(newPassword, salt, 100000, HashAlgorithmName.SHA256);
            byte[] passwordHash = pbkdf2.GetBytes(32);

            tokenEntry.User.PasswordHash = Convert.ToBase64String(passwordHash);
            tokenEntry.User.PasswordSalt = Convert.ToBase64String(salt);

            _context.Users.Update(tokenEntry.User);
            _context.PasswordResetTokens.Remove(tokenEntry);
            return await _context.SaveChangesAsync() > 0;
        }

        public async Task<AuthTokens?> RotateRefreshTokenAsync(string refreshToken)
        {
            if (string.IsNullOrWhiteSpace(refreshToken)) return null;
            var hash = HashRefreshToken(refreshToken);

            var stored = await _context.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
            // Geçersiz, süresi dolmuş veya iptal edilmiş → reddet
            if (stored == null || stored.RevokedAt != null || stored.ExpiresAt <= DateTime.UtcNow)
                return null;

            var user = await _context.Users.FindAsync(stored.UserId);
            if (user == null) return null;

            // Banlı kullanıcının oturumu yenilenemez
            if (user.IsBanned)
            {
                stored.RevokedAt = DateTime.UtcNow;
                _context.RefreshTokens.Update(stored);
                await _context.SaveChangesAsync();
                return null;
            }

            // Rotasyon: eski token'ı iptal et, yenisini üret (tek kullanımlık)
            stored.RevokedAt = DateTime.UtcNow;
            _context.RefreshTokens.Update(stored);

            var accessToken = _jwtService.GenerateToken(user.Id.ToString(), user.Role ?? "User");
            var newRefresh = await IssueRefreshTokenAsync(user.Id); // SaveChanges burada da çalışır
            return new AuthTokens(accessToken, newRefresh);
        }

        public async Task RevokeRefreshTokenAsync(string refreshToken)
        {
            if (string.IsNullOrWhiteSpace(refreshToken)) return;
            var hash = HashRefreshToken(refreshToken);
            var stored = await _context.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
            if (stored != null && stored.RevokedAt == null)
            {
                stored.RevokedAt = DateTime.UtcNow;
                _context.RefreshTokens.Update(stored);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<bool> DeleteUserAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return false;

            _context.Users.Remove(user);
            return await _context.SaveChangesAsync() > 0;
        }

        public async Task<bool> UpdateProfileAsync(int userId, string? name, string? avatar, string? motto, string? avatarBorderColor, string? preferences)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return false;

            if (!string.IsNullOrWhiteSpace(name))
                user.Name = name.Trim()[..Math.Min(name.Trim().Length, 50)];

            if (avatar != null)
                user.ProfilePicture = avatar;

            // null = değiştirme; boş string = temizle. Üst sınırları modelle uyumlu kırp.
            if (motto != null)
                user.Motto = motto.Trim() is { Length: > 0 } m ? m[..Math.Min(m.Length, 150)] : null;

            if (avatarBorderColor != null)
                user.AvatarBorderColor = avatarBorderColor.Trim() is { Length: > 0 } c ? c[..Math.Min(c.Length, 32)] : null;

            // null = değiştirme; boş string = temizle. JSON içeriği frontend tarafından üretilir/doğrulanır.
            if (preferences != null)
                user.Preferences = preferences.Length > 0 ? preferences : null;

            _context.Users.Update(user);
            return await _context.SaveChangesAsync() > 0;
        }
    }
}
