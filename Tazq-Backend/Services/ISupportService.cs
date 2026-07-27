using Tazq_App.Models;

namespace Tazq_App.Services
{
    // Destek mesajları ve istemci çökme raporlarının veri erişimi.
    // Controller yalnız HTTP ile ilgilenir; sorgular ve durum geçişleri burada.
    public interface ISupportService
    {
        Task<ClientCrash> ReportCrashAsync(ClientCrash crash, int? userId);
        /// <summary>
        /// Kilitlenmeler — SAYFALANMIS.
        ///
        /// Eskiden yalniz `limit` vardi: ilk N kayit doner, gerisine ulasmanin yolu
        /// bulunmazdi. Panel 15 istiyordu; 16. kilitlenme veritabaninda duruyor ama
        /// gorulemiyordu. Toplam sayi da doner — onsuz "sonraki sayfa var mi?"
        /// sorusu cevaplanamaz.
        /// </summary>
        Task<(List<ClientCrash> Items, int Total)> GetCrashesPageAsync(int limit, int offset, bool unresolvedOnly);
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
