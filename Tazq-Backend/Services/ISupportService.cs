using Tazq_App.Models;

namespace Tazq_App.Services
{
    // Destek mesajları ve istemci çökme raporlarının veri erişimi.
    // Controller yalnız HTTP ile ilgilenir; sorgular ve durum geçişleri burada.
    public interface ISupportService
    {
        Task<ClientCrash> ReportCrashAsync(ClientCrash crash, int? userId);
        Task<List<ClientCrash>> GetCrashesAsync(int limit);
        Task<bool> ResolveCrashAsync(int id);

        /// <summary>Kullanıcı bulunamazsa null döner.</summary>
        Task<SupportMessage?> CreateMessageAsync(int userId, string message);
        Task<List<SupportMessage>> GetMessagesForUserAsync(int userId);
        Task<List<SupportMessage>> GetAllMessagesAsync();
        Task<SupportMessage?> ReplyAsync(int id, string reply);
        Task<bool> MarkAsReadAsync(int id);
        Task<bool> DeleteMessageAsync(int id);
    }
}
