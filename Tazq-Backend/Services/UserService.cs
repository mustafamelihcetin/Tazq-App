using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Google.Apis.Auth;
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
        private readonly IGoogleTokenValidator _googleTokenValidator;
        private readonly IAppleTokenValidator _appleTokenValidator;
        private readonly IBackgroundTaskQueue _emailQueue;

        public UserService(AppDbContext context, ICustomEmailService emailService, IJwtService jwtService, ILogger<UserService> logger, IGoogleTokenValidator googleTokenValidator, IAppleTokenValidator appleTokenValidator, IBackgroundTaskQueue emailQueue)
        {
            _context = context;
            _emailService = emailService;
            _jwtService = jwtService;
            _logger = logger;
            _googleTokenValidator = googleTokenValidator;
            _appleTokenValidator = appleTokenValidator;
            _emailQueue = emailQueue;
        }

        // Hoş geldin maili üç akıştan tetiklenir (Google, Apple, e-posta doğrulama).
        // Kuyruk her işi kendi DI scope'unda çalıştırır; e-posta/ad closure'a değer olarak
        // kopyalanır ki iş çalışırken user entity'sinin durumuna bağımlı olmasın.
        private void EnqueueWelcomeEmail(string email, string name)
            => _emailQueue.Enqueue((sp, ct) =>
                sp.GetRequiredService<ICustomEmailService>().SendWelcomeEmailAsync(email, name));

        public async Task<bool> RegisterAsync(UserRegisterDto userDto)
        {
            // Soft-deleted hesaplar dahil e-posta kontrolü (global filtre bunları normalde gizler)
            var existing = await _context.Users.IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Email == userDto.Email);
            if (existing != null)
            {
                // Aktif ya da grace içinde silinmiş → e-posta kullanımda (grace içindeyse giriş yaparak geri getirilir)
                if (existing.DeletedAt == null || DateTime.UtcNow - existing.DeletedAt.Value <= AccountGracePeriod)
                    return false;
            }

            var hashed = PasswordHasher.Hash(userDto.Password);
            var code = GenerateVerificationCode();
            var user = new User
            {
                Name = userDto.Name,
                Email = userDto.Email,
                PasswordHash = hashed.Hash,
                PasswordSalt = hashed.Salt,
                PasswordIterations = hashed.Iterations,
                Role = "User",
                IsEmailVerified = false,
                EmailVerificationCode = code,
                EmailVerificationExpiresAt = DateTime.UtcNow.Add(EmailCodeLifetime),
            };

            // Eski kaydın silinmesi ile yeni kaydın eklenmesi tek atomik birim olmalı:
            // aksi halde araya giren bir hata eski hesabı silip yenisini oluşturmadan
            // bırakır ve kullanıcı geri dönüşü olmayan şekilde kaybolur. (Eskiden silme
            // ayrı bir SaveChanges'teydi ve tam bu açık vardı.)
            //
            // Atomikliği asıl sağlayan, Remove + Add'in TEK SaveChanges'te olması —
            // EF onu zaten örtük bir transaction'a sarar. Aşağıdaki açık transaction
            // fazladan emniyet: ileride araya ikinci bir SaveChanges eklenirse
            // atomiklik sessizce kaybolmasın. Bkz. UserServiceTransactionTests.
            await using var tx = await _context.Database.BeginTransactionAsync();

            if (existing != null)
                _context.Users.Remove(existing); // Grace dolmuş → e-postayı serbest bırak

            _context.Users.Add(user);
            var registered = await _context.SaveChangesAsync() > 0;
            await tx.CommitAsync();

            if (registered)
            {
                // Hoş geldin maili doğrulama sonrası; kayıtta doğrulama kodu gönderilir.
                // Kuyruğa devredilir: request scope'u kapandıktan sonra scoped servislere
                // dokunmamak için mail gönderimi kendi scope'unu açar.
                _emailQueue.Enqueue((sp, ct) =>
                    sp.GetRequiredService<ICustomEmailService>()
                      .SendVerificationEmailAsync(user.Email, user.Name, code));
            }

            return registered;
        }

        // Refresh token ömrü
        private static readonly TimeSpan RefreshTokenLifetime = TimeSpan.FromDays(60);

        // Hesap silme sonrası geri getirme (grace) süresi. Bu süre içinde tekrar giriş = reaktivasyon.
        public static readonly TimeSpan AccountGracePeriod = TimeSpan.FromDays(30);

        // E-posta doğrulama kodu ömrü + üretici
        public static readonly TimeSpan EmailCodeLifetime = TimeSpan.FromMinutes(10);
        private static string GenerateVerificationCode() => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

        // Silinmiş kullanıcıyı grace durumuna göre değerlendirir:
        //  - grace içinde  → reaktive eder (DeletedAt=null), true döner (giriş devam etsin)
        //  - grace geçmiş  → kalıcı siler, user'ı null yapar (yeni hesap gibi devam edilir)
        //  - silinmemiş     → dokunmaz, true döner
        private async Task<bool> ResolveSoftDeletedAsync(User? user)
        {
            if (user == null) return false;
            if (user.DeletedAt == null) return true;
            if (DateTime.UtcNow - user.DeletedAt.Value <= AccountGracePeriod)
            {
                user.DeletedAt = null; // reaktivasyon
                return true;
            }
            // Grace süresi dolmuş ama henüz temizlenmemiş → kalıcı sil, çağıran yeni hesap açsın
            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
            return false;
        }

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
            // Soft-deleted hesapları da bul (grace içinde giriş = reaktivasyon)
            var user = await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Email == userDto.Email);
            if (user == null || string.IsNullOrEmpty(user.PasswordSalt))
                return null;

            if (!PasswordHasher.Verify(userDto.Password, user.PasswordHash!, user.PasswordSalt, user.PasswordIterations))
                return null;

            // Parola doğru ve düz hâli elimizdeyken: hash eski/zayıf maliyetle üretildiyse
            // güncel maliyete taşı. Kullanıcı için görünmez, tek seferlik.
            if (PasswordHasher.NeedsRehash(user.PasswordIterations))
            {
                var upgraded = PasswordHasher.Hash(userDto.Password);
                user.PasswordHash = upgraded.Hash;
                user.PasswordSalt = upgraded.Salt;
                user.PasswordIterations = upgraded.Iterations;
                _context.Users.Update(user);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Upgraded password hash iterations for user {UserId}.", user.Id);
            }

            // Silinmişse: grace içinde reaktive et, süresi geçmişse girişi reddet
            bool wasReactivated = false;
            if (user.DeletedAt != null)
            {
                if (!await ResolveSoftDeletedAsync(user)) return null;
                wasReactivated = true;
            }

            // Banlı kullanıcı giriş yapamaz — sebep/bitiş bilgisiyle net bir yanıt döner
            if (user.IsCurrentlyBanned)
                return new AuthTokens("", "", IsBanned: true, BanReason: user.BanReason, BannedUntil: user.BannedUntil);

            // E-posta doğrulanmamışsa: yeni kod gönder, oturum açma; frontend doğrulama ekranına yönlendirir.
            if (!user.IsEmailVerified)
            {
                var code = GenerateVerificationCode();
                user.EmailVerificationCode = code;
                user.EmailVerificationExpiresAt = DateTime.UtcNow.Add(EmailCodeLifetime);
                _context.Users.Update(user);
                await _context.SaveChangesAsync();
                _emailQueue.Enqueue((sp, ct) =>
                    sp.GetRequiredService<ICustomEmailService>()
                      .SendVerificationEmailAsync(user.Email, user.Name, code));
                return new AuthTokens(string.Empty, string.Empty, false, false, true);
            }

            if (!string.IsNullOrEmpty(ipAddress))
            {
                user.LastLoginIp = ipAddress;
                _context.Users.Update(user);
                await _context.SaveChangesAsync();
            }

            var accessToken = _jwtService.GenerateToken(user.Id.ToString(), user.Role ?? "User");
            var refreshToken = await IssueRefreshTokenAsync(user.Id);
            return new AuthTokens(accessToken, refreshToken, false, wasReactivated);
        }

        public async Task<AuthTokens?> GoogleLoginAsync(string idToken, string? ipAddress)
        {
            GoogleJsonWebSignature.Payload? payload;
            try
            {
                payload = await _googleTokenValidator.ValidateAsync(idToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Google token validation failed.");
                return null;
            }

            if (payload == null || string.IsNullOrEmpty(payload.Email))
            {
                return null;
            }

            var user = await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Email == payload.Email);
            // Silinmişse: grace içinde reaktive et, süresi geçmişse temizle ve yeni hesap gibi devam et
            bool wasReactivated = false;
            if (user != null && user.DeletedAt != null)
            {
                if (DateTime.UtcNow - user.DeletedAt.Value <= AccountGracePeriod) { user.DeletedAt = null; wasReactivated = true; }
                else { _context.Users.Remove(user); await _context.SaveChangesAsync(); user = null; }
            }
            bool isNewUser = false;
            if (user == null)
            {
                isNewUser = true;
                user = new User
                {
                    Name = payload.Name ?? payload.Email.Split('@')[0],
                    Email = payload.Email,
                    Role = "User",
                    PasswordHash = string.Empty,
                    PasswordSalt = string.Empty,
                    IsEmailVerified = true // Google e-postayı doğrular
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                EnqueueWelcomeEmail(user.Email, user.Name);
            }

            if (user.IsCurrentlyBanned)
            {
                return new AuthTokens("", "", IsBanned: true, BanReason: user.BanReason, BannedUntil: user.BannedUntil);
            }

            if (!string.IsNullOrEmpty(ipAddress))
            {
                user.LastLoginIp = ipAddress;
                _context.Users.Update(user);
                await _context.SaveChangesAsync();
            }

            var accessToken = _jwtService.GenerateToken(user.Id.ToString(), user.Role ?? "User");
            var refreshToken = await IssueRefreshTokenAsync(user.Id);
            return new AuthTokens(accessToken, refreshToken, isNewUser, wasReactivated);
        }

        public async Task<AuthTokens?> AppleLoginAsync(AppleLoginDto dto, string? ipAddress)
        {
            try
            {
                var principal = await _appleTokenValidator.ValidateAsync(dto.IdentityToken);
                if (principal == null)
                {
                    _logger.LogWarning("Apple identity token validation failed.");
                    return null;
                }

                var email = principal.FindFirst("email")?.Value ?? principal.FindFirst(ClaimTypes.Email)?.Value;
                if (string.IsNullOrEmpty(email))
                {
                    _logger.LogWarning("Apple token did not contain email claim.");
                    return null;
                }

                var user = await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Email == email);
                // Silinmişse: grace içinde reaktive et, süresi geçmişse temizle ve yeni hesap gibi devam et
                bool wasReactivated = false;
                if (user != null && user.DeletedAt != null)
                {
                    if (DateTime.UtcNow - user.DeletedAt.Value <= AccountGracePeriod) { user.DeletedAt = null; wasReactivated = true; }
                    else { _context.Users.Remove(user); await _context.SaveChangesAsync(); user = null; }
                }
                bool isNewUser = false;
                if (user == null)
                {
                    isNewUser = true;
                    var firstName = dto.FirstName;
                    var lastName = dto.LastName;
                    string name;
                    
                    if (!string.IsNullOrWhiteSpace(firstName))
                    {
                        name = $"{firstName} {lastName}".Trim();
                    }
                    else if (email.Contains("privaterelay.appleid.com", System.StringComparison.OrdinalIgnoreCase))
                    {
                        name = "TAZQ Kullanıcısı";
                    }
                    else
                    {
                        name = email.Split('@')[0];
                    }

                    user = new User
                    {
                        Name = name,
                        Email = email,
                        Role = "User",
                        PasswordHash = string.Empty,
                        PasswordSalt = string.Empty,
                        IsEmailVerified = true // Apple e-postayı doğrular
                    };

                    _context.Users.Add(user);
                    await _context.SaveChangesAsync();

                    EnqueueWelcomeEmail(user.Email, user.Name);
                }

                if (user.IsCurrentlyBanned)
                {
                    return new AuthTokens("", "", IsBanned: true, BanReason: user.BanReason, BannedUntil: user.BannedUntil);
                }

                if (!string.IsNullOrEmpty(ipAddress))
                {
                    user.LastLoginIp = ipAddress;
                    _context.Users.Update(user);
                    await _context.SaveChangesAsync();
                }

                var accessToken = _jwtService.GenerateToken(user.Id.ToString(), user.Role ?? "User");
                var refreshToken = await IssueRefreshTokenAsync(user.Id);
                return new AuthTokens(accessToken, refreshToken, isNewUser, wasReactivated);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Apple Login");
                return null;
            }
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
            if (user == null) return false;

            var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            // Store SHA-256 hash; send raw token to user so a DB breach doesn't expose tokens
            using var sha256 = System.Security.Cryptography.SHA256.Create();
            var tokenHash = Convert.ToBase64String(sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(rawToken)));
            var expiration = DateTime.UtcNow.AddHours(1);

            // Güvenlik: yeni link gönderilince kullanıcının önceki tüm sıfırlama token'larını geçersiz kıl.
            // Böylece aynı anda yalnızca en son gönderilen link çalışır.
            var oldTokens = await _context.PasswordResetTokens.Where(t => t.UserId == user.Id).ToListAsync();
            if (oldTokens.Count > 0) _context.PasswordResetTokens.RemoveRange(oldTokens);

            var resetToken = new PasswordResetToken
            {
                UserId = user.Id,
                Token = tokenHash,
                Expiration = expiration
            };

            _context.PasswordResetTokens.Add(resetToken);
            await _context.SaveChangesAsync();

            var (resetEmail, resetName) = (user.Email, user.Name);
            _emailQueue.Enqueue((sp, ct) =>
                sp.GetRequiredService<ICustomEmailService>()
                  .SendForgotPasswordEmailAsync(resetEmail, resetName, rawToken));

            return true;
        }

        public async Task<bool> ResetPasswordAsync(string token, string newPassword)
        {
            using var sha256 = System.Security.Cryptography.SHA256.Create();
            var tokenHash = Convert.ToBase64String(sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(token)));
            var tokenEntry = await _context.PasswordResetTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.Token == tokenHash);
            if (tokenEntry == null || tokenEntry.Expiration < DateTime.UtcNow) return false;

            var hashed = PasswordHasher.Hash(newPassword);
            tokenEntry.User.PasswordHash = hashed.Hash;
            tokenEntry.User.PasswordSalt = hashed.Salt;
            tokenEntry.User.PasswordIterations = hashed.Iterations;

            _context.Users.Update(tokenEntry.User);
            _context.PasswordResetTokens.Remove(tokenEntry);
            return await _context.SaveChangesAsync() > 0;
        }

        public async Task<AuthTokens?> RotateRefreshTokenAsync(string refreshToken)
        {
            if (string.IsNullOrWhiteSpace(refreshToken)) return null;
            var hash = HashRefreshToken(refreshToken);

            var stored = await _context.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
            if (stored == null) return null;

            // Yeniden Kullanım Tespiti (Reuse Detection): Token zaten iptal edilmişse,
            // bu bir çalınma/replay belirtisidir. Kullanıcının tüm aktif oturumlarını kapat!
            if (stored.RevokedAt != null)
            {
                var allActive = await _context.RefreshTokens
                    .Where(t => t.UserId == stored.UserId && t.RevokedAt == null)
                    .ToListAsync();
                
                foreach (var t in allActive)
                {
                    t.RevokedAt = DateTime.UtcNow;
                }
                
                _context.RefreshTokens.UpdateRange(allActive);
                await _context.SaveChangesAsync();
                return null;
            }

            // Süresi dolmuş token → reddet
            if (stored.ExpiresAt <= DateTime.UtcNow)
                return null;

            var user = await _context.Users.FindAsync(stored.UserId);
            if (user == null || user.DeletedAt != null) return null;

            // Banlı kullanıcının oturumu yenilenemez
            if (user.IsCurrentlyBanned)
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
            var user = await _context.Users.FindAsync(userId); // FindAsync global filtreyi atlar
            if (user == null || user.DeletedAt != null) return false;

            // Soft-delete: veriyi koru, hesabı işaretle. Grace içinde tekrar giriş = reaktivasyon.
            user.DeletedAt = DateTime.UtcNow;

            // Tüm oturumları kapat: kullanıcının refresh token'larını iptal et (her cihazdan çıkış)
            var tokens = await _context.RefreshTokens.Where(t => t.UserId == userId).ToListAsync();
            _context.RefreshTokens.RemoveRange(tokens);

            _context.Users.Update(user);
            return await _context.SaveChangesAsync() > 0;
        }

        public async Task<AuthTokens?> VerifyEmailAsync(string email, string code, string? ipAddress)
        {
            var user = await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Email == email);
            if (user == null || user.IsCurrentlyBanned || user.DeletedAt != null) return null;

            if (!user.IsEmailVerified)
            {
                if (string.IsNullOrEmpty(user.EmailVerificationCode) ||
                    user.EmailVerificationExpiresAt == null ||
                    user.EmailVerificationExpiresAt < DateTime.UtcNow ||
                    user.EmailVerificationCode != code?.Trim())
                {
                    return null; // geçersiz veya süresi dolmuş kod
                }

                user.IsEmailVerified = true;
                user.EmailVerificationCode = null;
                user.EmailVerificationExpiresAt = null;

                // Doğrulama tamam → hoş geldin maili
                EnqueueWelcomeEmail(user.Email, user.Name);
            }

            if (!string.IsNullOrEmpty(ipAddress)) user.LastLoginIp = ipAddress;
            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            var accessToken = _jwtService.GenerateToken(user.Id.ToString(), user.Role ?? "User");
            var refreshToken = await IssueRefreshTokenAsync(user.Id);
            // Yeni doğrulanan kullanıcı ilk kez giriyor → onboarding gösterilsin
            return new AuthTokens(accessToken, refreshToken, true);
        }

        public async Task<bool> ResendVerificationCodeAsync(string email)
        {
            var user = await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Email == email);
            if (user == null || user.IsEmailVerified || user.DeletedAt != null) return false;

            var code = GenerateVerificationCode();
            user.EmailVerificationCode = code;
            user.EmailVerificationExpiresAt = DateTime.UtcNow.Add(EmailCodeLifetime);
            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            try { await _emailService.SendVerificationEmailAsync(user.Email, user.Name, code); return true; }
            catch (Exception ex) { _logger.LogError(ex, "Failed to resend verification email to {Email}", user.Email); return false; }
        }

        // 0=başarılı, 1=mevcut şifre yanlış (veya kullanıcı yok), 2=şifresiz hesap (Google/Apple)
        public async Task<int> ChangePasswordAsync(int userId, string currentPassword, string newPassword)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null || user.DeletedAt != null) return 1;
            if (string.IsNullOrEmpty(user.PasswordHash) || string.IsNullOrEmpty(user.PasswordSalt))
                return 2; // Google/Apple hesabı — şifresi yok

            if (!PasswordHasher.Verify(currentPassword, user.PasswordHash, user.PasswordSalt, user.PasswordIterations))
                return 1;

            var hashed = PasswordHasher.Hash(newPassword);
            user.PasswordHash = hashed.Hash;
            user.PasswordSalt = hashed.Salt;
            user.PasswordIterations = hashed.Iterations;

            _context.Users.Update(user);
            await _context.SaveChangesAsync();
            return 0;
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
