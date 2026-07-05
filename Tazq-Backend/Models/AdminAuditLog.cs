using System;

namespace Tazq_App.Models
{
    // Global admin denetim günlüğü — kim, ne zaman, ne yaptı (rol/ban/silme/bakım vb.)
    public class AdminAuditLog
    {
        public int Id { get; set; }
        public int? AdminId { get; set; }
        public string? AdminName { get; set; }
        public string Action { get; set; } = string.Empty;   // "role_change" | "delete_user" | "ban" | "unban" | "maintenance" | "export"
        public string? TargetType { get; set; }               // "user" | "system"
        public int? TargetUserId { get; set; }
        public string? TargetName { get; set; }
        public string? Details { get; set; }                  // serbest açıklama
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
