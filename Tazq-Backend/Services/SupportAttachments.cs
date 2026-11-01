using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    /// <summary>
    /// DESTEK FOTOĞRAFLARI (2026-11-01, kullanıcı: "destek kısmında dosya/fotoğraf ekleme olsun, MB sınırı olsun,
    /// sunucu şişmesin"). Konuşma düzeyinde saklanır; sınırlar sunucuda zorlanır (istemci yalnız kolaylık):
    ///   · fotoğraf başına ≤ 3 MB, konuşma başına ≤ 6, kullanıcı başına toplam ≤ 20 MB
    ///   · tür yalnız uzantıdan DEĞİL ilk baytlardan doğrulanır (JPEG, PNG, WEBP, HEIC)
    ///   · konuşma kapandıktan 90 gün sonra silinir (CrashRetentionService döngüsünde)
    /// </summary>
    public static class SupportAttachments
    {
        public const int MaxBytes = 3 * 1024 * 1024;
        public const int MaxPerConversation = 6;
        public const long MaxPerUserBytes = 20L * 1024 * 1024;
        public const int KeepDaysAfterClose = 90;

        public enum AddResult { Ok, NotFound, Closed, TooLarge, BadType, ConversationFull, UserQuotaFull }

        /// <summary>İlk baytlardan görsel türü; tanınmazsa null.</summary>
        public static string? SniffImageType(byte[] b)
        {
            if (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return "image/jpeg";
            if (b.Length >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return "image/png";
            if (b.Length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
            if (b.Length >= 12 && b[4] == 'f' && b[5] == 't' && b[6] == 'y' && b[7] == 'p')
            {
                var brand = System.Text.Encoding.ASCII.GetString(b, 8, 4);
                if (brand is "heic" or "heix" or "mif1" or "msf1" or "hevc") return "image/heic";
            }
            return null;
        }

        public static async Task<(AddResult Result, SupportAttachment? Item)> AddAsync(AppDbContext db, int messageId, int uploaderId, bool fromStaff, byte[] data)
        {
            if (data.Length == 0 || data.Length > MaxBytes) return (AddResult.TooLarge, null);
            var type = SniffImageType(data);
            if (type == null) return (AddResult.BadType, null);

            var msg = await db.SupportMessages.AsNoTracking().FirstOrDefaultAsync(m => m.Id == messageId);
            if (msg == null || (!fromStaff && msg.UserId != uploaderId)) return (AddResult.NotFound, null);
            if (msg.ClosedAt != null) return (AddResult.Closed, null);

            var inConversation = await db.SupportAttachments.CountAsync(a => a.SupportMessageId == messageId);
            if (inConversation >= MaxPerConversation) return (AddResult.ConversationFull, null);
            if (!fromStaff)
            {
                var used = await db.SupportAttachments.Where(a => a.UploaderId == uploaderId).SumAsync(a => (long?)a.SizeBytes) ?? 0;
                if (used + data.Length > MaxPerUserBytes) return (AddResult.UserQuotaFull, null);
            }

            var item = new SupportAttachment
            {
                SupportMessageId = messageId, UploaderId = uploaderId, FromStaff = fromStaff,
                ContentType = type, SizeBytes = data.Length, Data = data, CreatedAt = DateTime.UtcNow,
            };
            db.SupportAttachments.Add(item);
            await db.SaveChangesAsync();
            return (AddResult.Ok, item);
        }

        public record Meta(int Id, int SupportMessageId, bool FromStaff, DateTime At, int Size);

        /// <summary>Konuşmaların fotoğraf listesi — VERİ OLMADAN (yalnız kimlik/zaman/boyut).</summary>
        public static async Task<Dictionary<int, List<Meta>>> MetaForAsync(AppDbContext db, IEnumerable<int> messageIds)
        {
            var ids = messageIds.ToList();
            if (ids.Count == 0) return new();
            var rows = await db.SupportAttachments.AsNoTracking()
                .Where(a => ids.Contains(a.SupportMessageId))
                .OrderBy(a => a.CreatedAt)
                .Select(a => new Meta(a.Id, a.SupportMessageId, a.FromStaff, a.CreatedAt, a.SizeBytes))
                .ToListAsync();
            return rows.GroupBy(r => r.SupportMessageId).ToDictionary(g => g.Key, g => g.ToList());
        }

        /// <summary>Kapanalı 90 günü geçen konuşmaların fotoğrafları + sahipsiz kalanlar silinir.</summary>
        public static async Task<int> PurgeAsync(AppDbContext db, DateTime now, CancellationToken ct = default)
        {
            var cutoff = now.AddDays(-KeepDaysAfterClose);
            var oldIds = await db.SupportMessages.AsNoTracking().Where(m => m.ClosedAt != null && m.ClosedAt < cutoff).Select(m => m.Id).ToListAsync(ct);
            var stale = await db.SupportAttachments
                .Where(a => oldIds.Contains(a.SupportMessageId) || !db.SupportMessages.Any(m => m.Id == a.SupportMessageId))
                .ToListAsync(ct);
            if (stale.Count == 0) return 0;
            db.SupportAttachments.RemoveRange(stale);
            await db.SaveChangesAsync(ct);
            return stale.Count;
        }
    }
}
