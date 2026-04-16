using Tazq_App.Models;

namespace Tazq_App.Services
{
    public interface IUserService
    {
        Task<bool> RegisterAsync(UserRegisterDto userDto);
        Task<string?> LoginAsync(UserLoginDto userDto, string? ipAddress);
        Task<User?> GetUserByIdAsync(int userId);
        Task<bool> UpdateNotificationPreferencesAsync(int userId, UserNotificationPreferences preferences);
        Task<string?> UploadProfilePictureAsync(int userId, IFormFile file);
        Task<bool> SendForgotPasswordTokenAsync(string email);
        Task<bool> ResetPasswordAsync(string token, string newPassword);
        Task<string?> RefreshSessionAsync(string oldToken, string? currentIp);
        Task<bool> DeleteUserAsync(int userId);
    }
}
