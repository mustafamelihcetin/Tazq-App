using Tazq_App.Models;

namespace Tazq_App.Services
{
    public interface IUserService
    {
        Task<bool> RegisterAsync(UserRegisterDto userDto);
        Task<AuthTokens?> LoginAsync(UserLoginDto userDto, string? ipAddress);
        Task<AuthTokens?> GoogleLoginAsync(string idToken, string? ipAddress);
        Task<AuthTokens?> AppleLoginAsync(AppleLoginDto dto, string? ipAddress);
        Task<User?> GetUserByIdAsync(int userId);
        Task<bool> UpdateNotificationPreferencesAsync(int userId, UserNotificationPreferences preferences);
        Task<bool> SendForgotPasswordTokenAsync(string email);
        Task<bool> ResetPasswordAsync(string token, string newPassword);
        // Ham refresh token'ı doğrular (DB hash), rotasyona sokar ve yeni access+refresh döndürür.
        Task<AuthTokens?> RotateRefreshTokenAsync(string refreshToken);
        Task RevokeRefreshTokenAsync(string refreshToken);
        Task<bool> DeleteUserAsync(int userId);
        Task<bool> UpdateProfileAsync(int userId, string? name, string? avatar, string? motto, string? avatarBorderColor, string? preferences);
    }

    // Access (kısa ömürlü JWT) + Refresh (uzun ömürlü, DB-destekli) token çifti
    public record AuthTokens(string Token, string RefreshToken, bool IsNewUser = false, bool IsReactivated = false);
}
