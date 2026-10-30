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
                .Include(m => m.Replies)
                .OrderByDescending(m => m.LastActivityAt ?? m.CreatedAt)
                .AsNoTracking()
                .ToListAsync();

        public async Task<List<SupportMessage>> GetAllMessagesAsync()
            => await _context.SupportMessages
                .Include(m => m.Replies)
                .OrderByDescending(m => m.LastActivityAt ?? m.CreatedAt)
                .AsNoTracking()
                .ToListAsync();

        /*
          DESTEK = KONUŞMA (2026-10-31, kullanıcı: "cevap verdikten sonra kullanıcıya aynı mesaja yanıt
          verme şansı vermiyoruz; profesyonel bir yaklaşım lazım"; "sohbeti bitirme yetkisi her iki
          tarafta da olsun"). Eskiden tek alan vardı (AdminReply): ikinci ekip yanıtı birincinin
          ÜSTÜNE yazılıyor, kullanıcı hiç yazamıyordu.
            · İlk mesaj Message'ta kalır; devamı Replies'ta (kim, ne, ne zaman).
            · ESKİ tek yanıt ilk yeni harekette Replies'a taşınır (konuşmadan düşmesin).
            · AdminReply/RepliedAt son ekip yanıtıyla güncel tutulur — eski uygulama sürümleri bozulmaz.
            · Kullanıcı ekip yanıtlamadan üst üste en fazla MaxUserStreak mesaj yazar (ilk mesaj dahil):
              kutuyu doldurmasın, "yanıtımızı bekle" desin.
            · İki taraf da kapatabilir; kapalı konuşmaya yazılmaz (kullanıcı yeni mesajla başlar).
        */
        public const int MaxUserStreak = 3;

        public static List<SupportThreadEntry> ThreadOf(SupportMessage m)
        {
            var list = new List<SupportThreadEntry> { new(false, m.Message, m.CreatedAt) };
            var replies = m.Replies.OrderBy(r => r.CreatedAt).ThenBy(r => r.Id).ToList();
            // Eski tek yanıt henüz taşınmadıysa (hiç ekip satırı yok) konuşmaya ekle.
            if (!string.IsNullOrWhiteSpace(m.AdminReply) && !replies.Any(r => r.FromStaff))
                list.Add(new(true, m.AdminReply!, m.RepliedAt ?? m.CreatedAt));
            list.AddRange(replies.Select(r => new SupportThreadEntry(r.FromStaff, r.Body, r.CreatedAt)));
            return list;
        }

        /// <summary>Sondan geriye, ekip yanıtına kadar kullanıcı mesajı sayısı.</summary>
        public static int UserStreak(SupportMessage m)
        {
            var n = 0;
            var thread = ThreadOf(m);
            for (var i = thread.Count - 1; i >= 0 && !thread[i].FromStaff; i--) n++;
            return n;
        }

        public static bool CanUserReply(SupportMessage m) => m.ClosedAt == null && UserStreak(m) < MaxUserStreak;

        private static void MaterializeLegacyReply(SupportMessage m)
        {
            if (!string.IsNullOrWhiteSpace(m.AdminReply) && !m.Replies.Any(r => r.FromStaff))
                m.Replies.Add(new SupportReply { FromStaff = true, Body = m.AdminReply!, CreatedAt = m.RepliedAt ?? m.CreatedAt });
        }

        private Task<SupportMessage?> LoadAsync(int id) =>
            _context.SupportMessages.Include(m => m.Replies).FirstOrDefaultAsync(m => m.Id == id);

        public async Task<SupportMessage?> ReplyAsync(int id, string reply, int? staffUserId = null)
        {
            var msg = await LoadAsync(id);
            if (msg == null || msg.ClosedAt != null) return null;

            var now = DateTime.UtcNow;
            var body = ClampText(reply, MaxReplyLength);
            MaterializeLegacyReply(msg);
            msg.Replies.Add(new SupportReply { FromStaff = true, AuthorUserId = staffUserId, Body = body, CreatedAt = now });
            msg.AdminReply = body;
            msg.RepliedAt = now;
            msg.LastActivityAt = now;
            msg.IsRead = true; // Yanıtlanan mesaj okunmuş sayılır.
            await _context.SaveChangesAsync();
            return msg;
        }

        public async Task<(UserReplyOutcome Outcome, SupportMessage? Message)> UserReplyAsync(int userId, int id, string body)
        {
            var msg = await LoadAsync(id);
            if (msg == null || msg.UserId != userId) return (UserReplyOutcome.NotFound, null);
            if (msg.ClosedAt != null) return (UserReplyOutcome.Closed, msg);
            if (!CanUserReply(msg)) return (UserReplyOutcome.WaitForStaff, msg);

            var now = DateTime.UtcNow;
            MaterializeLegacyReply(msg);
            msg.Replies.Add(new SupportReply { FromStaff = false, AuthorUserId = userId, Body = ClampText(body, MaxMessageLength), CreatedAt = now });
            msg.LastActivityAt = now;
            msg.IsRead = false; // ekip kutusunda yeniden "yeni" olur ve üste çıkar
            await _context.SaveChangesAsync();
            return (UserReplyOutcome.Ok, msg);
        }

        public async Task<bool> CloseAsync(int id, bool byStaff, int? userId = null)
        {
            var msg = await _context.SupportMessages.FindAsync(id);
            if (msg == null || (!byStaff && msg.UserId != userId)) return false;
            if (msg.ClosedAt != null) return true; // zaten kapalı — tekrar kapatmak hata değil
            msg.ClosedAt = DateTime.UtcNow;
            msg.ClosedBy = byStaff ? "staff" : "user";
            msg.LastActivityAt = msg.ClosedAt;
            msg.IsRead = true; // kapalı konuşma ekipten iş beklemez
            await _context.SaveChangesAsync();
            return true;
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
