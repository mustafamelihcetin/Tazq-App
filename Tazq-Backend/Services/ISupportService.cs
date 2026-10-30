using Tazq_App.Models;

namespace Tazq_App.Services
{
    // Destek mesajları ve istemci çökme raporlarının veri erişimi.
    // Controller yalnız HTTP ile ilgilenir; sorgular ve durum geçişleri burada.
    public enum UserReplyOutcome { Ok, NotFound, Closed, WaitForStaff }

    /// <summary>Konuşmanın tek satırı — ilk mesaj, eski tek yanıt ve Replies tek sırada.</summary>
    public record SupportThreadEntry(bool FromStaff, string Body, DateTime At);

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
        /// <summary>Ekip yanıtı konuşmaya eklenir. Kapalı konuşmada null (bkz. ReplyOutcome).</summary>
        Task<SupportMessage?> ReplyAsync(int id, string reply, int? staffUserId = null);
        /// <summary>Kullanıcı kendi konuşmasına yazar.</summary>
        Task<(UserReplyOutcome Outcome, SupportMessage? Message)> UserReplyAsync(int userId, int id, string body);
        /// <summary>Konuşmayı kapatır (iki taraf da). Kullanıcı yalnız kendininkini kapatabilir.</summary>
        Task<bool> CloseAsync(int id, bool byStaff, int? userId = null);
        Task<bool> MarkAsReadAsync(int id);
        Task<bool> DeleteMessageAsync(int id);
    }
}
