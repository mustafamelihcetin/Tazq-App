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

        public async Task<List<ClientCrash>> GetCrashesAsync(int limit)
            => await _context.ClientCrashes
                .OrderByDescending(c => c.CreatedAt)
                .Take(limit)
                .AsNoTracking()
                .ToListAsync();

        public async Task<bool> ResolveCrashAsync(int id)
        {
            var crash = await _context.ClientCrashes.FindAsync(id);
            if (crash == null) return false;

            crash.IsResolved = true;
            await _context.SaveChangesAsync();
            return true;
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
                Message = message.Trim(),
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

            msg.AdminReply = reply.Trim();
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
