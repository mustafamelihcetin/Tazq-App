using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    public class SupportService : ISupportService
    {
        private readonly AppDbContext _context;

        public SupportService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<ClientCrash> ReportCrashAsync(ClientCrash crash, int? userId)
        {
            // Oturum açık kullanıcıdan geldiyse çökmeyi hesaba bağla (triyaj için).
            if (userId != null)
            {
                crash.UserId = userId.Value;
                var user = await _context.Users.FindAsync(userId.Value);
                if (user != null) crash.UserEmail = user.Email;
            }

            _context.ClientCrashes.Add(crash);
            await _context.SaveChangesAsync();
            return crash;
        }

        public async Task<(List<ClientCrash> Items, int Total)> GetCrashesPageAsync(int limit, int offset, bool unresolvedOnly)
        {
            // Filtre SAYIMDAN ONCE uygulanir: "cozulmemis" secilince toplam da
            // cozulmemislerin sayisi olmali, yoksa sayfalama bos sayfalara tiklatir.
            var q = _context.ClientCrashes.AsNoTracking().AsQueryable();
            if (unresolvedOnly) q = q.Where(c => !c.IsResolved);

            var total = await q.CountAsync();
            var items = await q
                // Eşitlik bozucu: aynı saniyeye düşen kayıtlar (toplu ekleme, çökme dalgası)
                // sıralamada tanımsız kalır ve sayfalar arasında yer değiştirir. Id benzersiz.
                .OrderByDescending(c => c.CreatedAt).ThenByDescending(c => c.Id)
                .Skip(Math.Max(offset, 0))
                .Take(Math.Clamp(limit, 1, 200))
                .ToListAsync();

            return (items, total);
        }

        public async Task<bool> ResolveCrashAsync(int id)
        {
            var crash = await _context.ClientCrashes.FindAsync(id);
            if (crash == null) return false;

            crash.IsResolved = true;
            await _context.SaveChangesAsync();
            return true;
        }

        /*
          DESTEK METİNLERİNİN UZUNLUK TAVANI YOKTU.

          `Message` ve `AdminReply` sütunları `text` ve gelen değer olduğu gibi
          yazılıyordu. Çökme raporu ucu (SupportController.ReportCrash) tam olarak bu
          sebeple kırpılmıştı; aynı düşünce buraya uygulanmamıştı.

          Fark şu: destek mesajı `[Authorize]` arkasında, yani saldırganın önce hesap
          açması gerekiyor — ama kayıt ücretsiz, dolayısıyla bu gerçek bir engel değil.
          Sınırsız bir metin alanı, veritabanını ve (mesaj e-postayla da gönderildiği
          için) SMTP kuyruğunu tek istekle şişirebilirdi.

          SINIRLAR ARAYÜZÜN ÇOK ÜSTÜNDE, bilerek: uygulamadaki alan 500 karakterle
          (SupportModal), admin yanıtı 1000 karakterle sınırlı. Sunucu tarafındaki 2000 /
          4000, arayüz sınırı ileride gevşetilirse meşru kullanımı kesmez; kırptığı tek
          şey elle atılan uç isteklerdir.
        */
        private const int MaxMessageLength = 2_000;
        private const int MaxReplyLength = 4_000;

        private static string ClampText(string? value, int max)
        {
            var v = (value ?? string.Empty).Trim();
            return v.Length <= max ? v : v[..max];
        }

        public async Task<SupportMessage?> CreateMessageAsync(int userId, string message)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return null;

            var supportMsg = new SupportMessage
            {
                UserId = user.Id,
                UserName = user.Name,
                UserEmail = user.Email,
                Message = ClampText(message, MaxMessageLength),
                CreatedAt = DateTime.UtcNow,
                IsRead = false,
            };

            _context.SupportMessages.Add(supportMsg);
            await _context.SaveChangesAsync();
            return supportMsg;
        }

        public async Task<List<SupportMessage>> GetMessagesForUserAsync(int userId)
            => await _context.SupportMessages
                .Where(m => m.UserId == userId)
                .OrderByDescending(m => m.CreatedAt)
                .AsNoTracking()
                .ToListAsync();

        public async Task<List<SupportMessage>> GetAllMessagesAsync()
            => await _context.SupportMessages
                .OrderByDescending(m => m.CreatedAt)
                .AsNoTracking()
                .ToListAsync();

        public async Task<SupportMessage?> ReplyAsync(int id, string reply)
        {
            var msg = await _context.SupportMessages.FindAsync(id);
            if (msg == null) return null;

            msg.AdminReply = ClampText(reply, MaxReplyLength);
            msg.RepliedAt = DateTime.UtcNow;
            msg.IsRead = true; // Yanıtlanan mesaj okunmuş sayılır.
            await _context.SaveChangesAsync();
            return msg;
        }

        public async Task<bool> MarkAsReadAsync(int id)
        {
            var msg = await _context.SupportMessages.FindAsync(id);
            if (msg == null) return false;

            msg.IsRead = true;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteMessageAsync(int id)
        {
            var msg = await _context.SupportMessages.FindAsync(id);
            if (msg == null) return false;

            _context.SupportMessages.Remove(msg);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
