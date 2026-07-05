using System;

namespace Tazq_App.Models
{
    // Ban/unban denetim kaydı — kim, ne zaman, neden, ne kadar süreyle
    public class BanHistory
    {
        public int Id { get; set; }
        public int UserId { get; set; }              // banlanan/banı kaldırılan kullanıcı
        public string Action { get; set; } = "ban";  // "ban" | "unban"
        public string? Reason { get; set; }          // ban sebebi (seçenek etiketi veya serbest metin)
        public int? DurationDays { get; set; }        // null = kalıcı (ban için)
        public DateTime? BannedUntil { get; set; }    // süreli ban bitiş zamanı
        public int? AdminId { get; set; }             // işlemi yapan admin
        public string? AdminName { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
