using Microsoft.EntityFrameworkCore;
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

        public UserService(AppDbContext context, ICustomEmailService emailService, IJwtService jwtService)
        {
            _context = context;
            _emailService = emailService;
            _jwtService = jwtService;
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

        public async Task<string?> LoginAsync(UserLoginDto userDto, string? ipAddress)
        {
            Console.WriteLine($">>> Login denemesi: {userDto.Email}");
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == userDto.Email);
            if (user == null) {
                Console.WriteLine(">>> HATA: Kullanıcı bulunamadı!");
                return null;
            }
            if (string.IsNullOrEmpty(user.PasswordSalt)) {
                Console.WriteLine(">>> HATA: Kullanıcı Salt verisi boş!");
                return null;
            }

            using var pbkdf2 = new Rfc2898DeriveBytes(userDto.Password, Convert.FromBase64String(user.PasswordSalt), 100000, HashAlgorithmName.SHA256);
            var computedHash = Convert.ToBase64String(pbkdf2.GetBytes(32));

            if (computedHash != user.PasswordHash) {
                Console.WriteLine($">>> HATA: Şifre uyuşmuyor! Gelen: {userDto.Password}");
                return null;
            }
            
            Console.WriteLine(">>> Login BAŞARILI!");

            if (!string.IsNullOrEmpty(ipAddress))
            {
                user.LastLoginIp = ipAddress;
                _context.Users.Update(user);
                await _context.SaveChangesAsync();
            }

            return _jwtService.GenerateToken(user.Id.ToString(), user.Role ?? "User");
        }

        public async Task<User?> GetUserByIdAsync(int userId)
        {
            return await _context.Users.Include(u => u.NotificationPreferences).FirstOrDefaultAsync(u => u.Id == userId);
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

        public async Task<string?> UploadProfilePictureAsync(int userId, IFormFile file)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null || file == null || file.Length == 0) return null;

            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "profile_pictures");
            if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

            var fileName = $"{userId}_{Path.GetFileName(file.FileName)}";
            var filePath = Path.Combine(uploadsFolder, fileName);

            using var stream = new FileStream(filePath, FileMode.Create);
            await file.CopyToAsync(stream);

            user.ProfilePicture = $"/profile_pictures/{fileName}";
            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            return user.ProfilePicture;
        }

        public async Task<bool> SendForgotPasswordTokenAsync(string email)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null) return true; // Pretend success for security

            var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            var expiration = DateTime.UtcNow.AddHours(1);

            var resetToken = new PasswordResetToken
            {
                UserId = user.Id,
                Token = token,
                Expiration = expiration
            };

            _context.PasswordResetTokens.Add(resetToken);
            await _context.SaveChangesAsync();

            var mailBody = $"Şifre sıfırlama kodunuz: <b>{token}</b>";
            await _emailService.SendEmailAsync(user.Email, "Şifre Sıfırlama", mailBody);

            return true;
        }

        public async Task<bool> ResetPasswordAsync(string token, string newPassword)
        {
            var tokenEntry = await _context.PasswordResetTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.Token == token);
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

        public async Task<string?> RefreshSessionAsync(string oldToken, string? currentIp)
        {
            var handler = new JwtSecurityTokenHandler();
            try
            {
                var jwtToken = handler.ReadJwtToken(oldToken);
                var userIdStr = jwtToken.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId)) return null;

                var user = await _context.Users.FindAsync(userId);
                if (user == null) return null;

                // IP check (allowing same subnet for mobile roaming if needed, keeping simple for now)
                if (!string.IsNullOrEmpty(currentIp) && !string.IsNullOrEmpty(user.LastLoginIp))
                {
                    var oldRange = user.LastLoginIp.Split('.').Take(2);
                    var newRange = currentIp.Split('.').Take(2);
                    if (!oldRange.SequenceEqual(newRange)) return null;
                }

                return _jwtService.GenerateToken(user.Id.ToString(), user.Role ?? "User");
            }
            catch { return null; }
        }

        public async Task<bool> DeleteUserAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return false;

            _context.Users.Remove(user);
            return await _context.SaveChangesAsync() > 0;
        }
    }
}
