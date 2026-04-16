namespace Tazq_App.Services
{
    public interface IJwtService
    {
        string GenerateToken(string userId, string role);
    }
}
