using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    public class PaymentService : IPaymentService
    {
        private readonly AppDbContext _db;
        private readonly ICryptoService? _crypto;

        // TaskService.MaxActiveTasksPerUser (200) ile aynı mantık — bir kullanıcı ödeme
        // listesini sınırsız büyütemez. Gerçek bir hanenin aylık ödeme sayısı bunun çok
        // altında; sınır kötüye kullanıma karşı, normal kullanımı etkilemez.
        private const int MaxPaymentsPerUser = 100;
        private const int MaxTitleLength = 100;
        private const int MaxCategoryLength = 40;

        public PaymentService(AppDbContext db, ICryptoService? crypto = null)
        {
            _db = db;
            _crypto = crypto;
        }

        /*
          BAŞLIK ŞİFRELEME (2026-11-01). Yeni yazılan her başlık kullanıcı anahtarıyla şifrelenir. Okurken önce geçerli,
          sonra eski anahtarlar denenir; hiçbiri tutmazsa değer ŞİFRELENMEDEN ÖNCE yazılmış düz metindir ve olduğu gibi
          döner — mevcut kullanıcıların listesi bozulmaz (görevlerdeki SafeDecrypt deseni).
          Yanıta çözülmüş başlık giderken izlenen varlık bağlamdan AYRILIR: düz metin yanlışlıkla geri kaydedilemez.
        */
        private string Enc(int userId, string plain) =>
            _crypto == null || plain.Length == 0 ? plain : _crypto.Encrypt(plain, _crypto.GetKeyForUser(userId));

        private string Dec(int userId, string stored)
        {
            if (_crypto == null || string.IsNullOrEmpty(stored)) return stored;
            try { return _crypto.Decrypt(stored, _crypto.GetKeyForUser(userId)); } catch { /* eski anahtarlar */ }
            foreach (var key in _crypto.GetLegacyKeysForUser(userId) ?? Array.Empty<byte[]>())
            {
                try { return _crypto.Decrypt(stored, key); } catch { /* sıradaki */ }
            }
            return stored; // şifreleme öncesi düz kayıt
        }

        private Payment Out(int userId, Payment p)
        {
            if (_db.Entry(p).State != EntityState.Detached) _db.Entry(p).State = EntityState.Detached;
            p.Title = Dec(userId, p.Title);
            return p;
        }

        // Uygulamanın desteklediği birimler (istemci: shared/utils/currency.ts). Bilinmeyen → null (ana birim).
        private static readonly HashSet<string> Currencies = new() { "TRY", "USD", "EUR", "GBP" };
        private static string? NormalizeCurrency(string? c)
        {
            var up = c?.Trim().ToUpperInvariant();
            return up != null && Currencies.Contains(up) ? up : null;
        }

        private static string Clamp(string value, int max) =>
            string.IsNullOrEmpty(value) ? string.Empty : (value.Length <= max ? value : value[..max]);

        public async Task<List<Payment>> GetPaymentsAsync(int userId)
        {
            var list = await _db.Payments
                .AsNoTracking()
                .Where(p => p.UserId == userId)
                .OrderBy(p => p.DueDay)
                .ToListAsync();
            foreach (var p in list) p.Title = Dec(userId, p.Title);
            return list;
        }

        public async Task<Payment?> CreatePaymentAsync(int userId, string title, decimal amount, int dueDay, PaymentRecurrence recurrence, DateTime? nextDueDate, string? category, string? currency = null, bool isVariable = false, int? installmentCount = null, string? installmentStart = null, string? icon = null, string? color = null, int? reminderDays = null)
        {
            var count = await _db.Payments.CountAsync(p => p.UserId == userId);
            if (count >= MaxPaymentsPerUser)
                throw new InvalidOperationException($"PAYMENT_LIMIT_REACHED:{MaxPaymentsPerUser}");

            var payment = new Payment
            {
                UserId = userId,
                Title = Enc(userId, Clamp((title ?? string.Empty).Trim(), MaxTitleLength)),
                Amount = amount,
                DueDay = Math.Clamp(dueDay, 1, 31),
                Recurrence = recurrence,
                NextDueDate = nextDueDate,
                Category = category == null ? null : Clamp(category.Trim(), MaxCategoryLength),
                Currency = NormalizeCurrency(currency),
            };
            ApplyKind(payment, isVariable, installmentCount, installmentStart);
            ApplyAppearance(payment, icon, color, reminderDays);
            _db.Payments.Add(payment);
            await _db.SaveChangesAsync();
            return Out(userId, payment);
        }

        public async Task<Payment?> UpdatePaymentAsync(int userId, int paymentId, string title, decimal amount, int dueDay, PaymentRecurrence recurrence, DateTime? nextDueDate, string? category, string? currency = null, bool isVariable = false, int? installmentCount = null, string? installmentStart = null, string? icon = null, string? color = null, int? reminderDays = null)
        {
            var payment = await _db.Payments.FirstOrDefaultAsync(p => p.Id == paymentId && p.UserId == userId);
            if (payment == null) return null;

            payment.Title = Enc(userId, Clamp((title ?? string.Empty).Trim(), MaxTitleLength));
            payment.Amount = amount;
            payment.DueDay = Math.Clamp(dueDay, 1, 31);
            payment.Recurrence = recurrence;
            payment.NextDueDate = nextDueDate;
            payment.Category = category == null ? null : Clamp(category.Trim(), MaxCategoryLength);
            payment.Currency = NormalizeCurrency(currency);
            ApplyKind(payment, isVariable, installmentCount, installmentStart);
            ApplyAppearance(payment, icon, color, reminderDays);
            await _db.SaveChangesAsync();
            return Out(userId, payment);
        }

        /// <summary>İkon/renk/hatırlatma: biçimi tutmayan değer saklanmaz; hatırlatma -1..30 aralığına kısılır.</summary>
        private static void ApplyAppearance(Payment p, string? icon, string? color, int? reminderDays)
        {
            p.Icon = icon != null && System.Text.RegularExpressions.Regex.IsMatch(icon, @"^[a-z]{1,16}$") ? icon : null;
            p.Color = color != null && System.Text.RegularExpressions.Regex.IsMatch(color, @"^#[0-9A-Fa-f]{6}$") ? color : null;
            p.ReminderDays = reminderDays is int d ? Math.Clamp(d, -1, 30) : null;
        }

        /// <summary>
        /// Değişken tutar + taksit alanları. Taksit yalnız tekrarlayan ödemede anlamlı; sayı 2–120'ye kısılır,
        /// başlangıç biçimi ("YYYY-MM" / "YYYY") tutmuyorsa taksit yok sayılır (geçersiz veri sessizce saklanmaz).
        /// </summary>
        private static void ApplyKind(Payment p, bool isVariable, int? count, string? start)
        {
            p.IsVariable = isVariable;
            var okStart = start != null && (p.Recurrence == PaymentRecurrence.Yearly
                ? System.Text.RegularExpressions.Regex.IsMatch(start, @"^\d{4}$")
                : System.Text.RegularExpressions.Regex.IsMatch(start, @"^\d{4}-(0[1-9]|1[0-2])$"));
            if (p.Recurrence != PaymentRecurrence.Once && count is int c && c >= 2 && okStart)
            {
                p.InstallmentCount = Math.Clamp(c, 2, 120);
                p.InstallmentStart = start;
            }
            else
            {
                p.InstallmentCount = null;
                p.InstallmentStart = null;
            }
        }

        public async Task<bool> DeletePaymentAsync(int userId, int paymentId)
        {
            var payment = await _db.Payments.FirstOrDefaultAsync(p => p.Id == paymentId && p.UserId == userId);
            if (payment == null) return false;

            // Geçmiş korunur, yalnız bağ kopar (sağlayıcıdan bağımsız: FK davranışına güvenilmez).
            foreach (var r in await _db.PaymentRecords.Where(r => r.PaymentId == paymentId && r.UserId == userId).ToListAsync())
                r.PaymentId = null;
            _db.Payments.Remove(payment);
            return await _db.SaveChangesAsync() > 0;
        }

        public async Task<Payment?> MarkPaidAsync(int userId, int paymentId, string cycleKey, decimal? actualAmount = null)
        {
            var payment = await _db.Payments.FirstOrDefaultAsync(p => p.Id == paymentId && p.UserId == userId);
            if (payment == null) return null;

            var cycle = Clamp(cycleKey, 16);
            payment.LastPaidCycleKey = cycle;
            // DEĞİŞKEN TUTAR: o ayın gerçek tutarı geçmişe yazılır ve bir sonraki tahmin olur.
            var paidAmount = payment.Amount;
            if (actualAmount is decimal a && a >= 0 && a <= 1_000_000_000m)
            {
                paidAmount = a;
                if (payment.IsVariable) payment.Amount = a;
            }
            // Aynı dönem için tek kayıt (çift dokunuş geçmişi şişirmesin).
            var exists = await _db.PaymentRecords.AnyAsync(r => r.UserId == userId && r.PaymentId == paymentId && r.CycleKey == cycle);
            if (!exists)
                _db.PaymentRecords.Add(new PaymentRecord
                {
                    UserId = userId, PaymentId = paymentId, Title = payment.Title,
                    Amount = paidAmount, Currency = payment.Currency, CycleKey = cycle, PaidAt = DateTime.UtcNow,
                });
            await _db.SaveChangesAsync();
            return Out(userId, payment);
        }

        /// <summary>Son `months` ayın ödemeleri, yeniden eskiye. Pencere 1–24 ay.</summary>
        public async Task<List<PaymentRecord>> GetHistoryAsync(int userId, int months)
        {
            await BackfillLegacyPaidAsync(userId);
            var since = DateTime.UtcNow.AddMonths(-Math.Clamp(months, 1, 24));
            var rows = await _db.PaymentRecords.AsNoTracking()
                .Where(r => r.UserId == userId && r.PaidAt >= since)
                .OrderByDescending(r => r.PaidAt)
                .ToListAsync();
            foreach (var r in rows) r.Title = Dec(userId, r.Title);
            return rows;
        }

        /// <summary>
        /// Geçmiş tablosundan ÖNCE "ödendi" denmiş ödemeler yalnız LastPaidCycleKey taşır;
        /// kaydı olmadığı için grafik o ayı boş gösteriyordu. Eksik kaydı bir kez üretir.
        /// Gerçek ödeme anı bilinmez → dönemin vade günü (gelecekteyse şimdi).
        /// </summary>
        private async Task BackfillLegacyPaidAsync(int userId)
        {
            var paid = await _db.Payments.Where(p => p.UserId == userId && p.LastPaidCycleKey != null).ToListAsync();
            if (paid.Count == 0) return;
            var ids = paid.Select(p => p.Id).ToList();
            var have = await _db.PaymentRecords.Where(r => r.UserId == userId && r.PaymentId != null && ids.Contains(r.PaymentId.Value))
                .Select(r => new { r.PaymentId, r.CycleKey }).ToListAsync();
            var missing = paid.Where(p => !have.Any(h => h.PaymentId == p.Id && h.CycleKey == p.LastPaidCycleKey)).ToList();
            if (missing.Count == 0) return;
            foreach (var p in missing)
                _db.PaymentRecords.Add(new PaymentRecord
                {
                    UserId = userId, PaymentId = p.Id, Title = p.Title, Amount = p.Amount, Currency = p.Currency,
                    CycleKey = p.LastPaidCycleKey!, PaidAt = EstimatePaidAt(p, DateTime.UtcNow),
                });
            await _db.SaveChangesAsync();
        }

        internal static DateTime EstimatePaidAt(Payment p, DateTime now)
        {
            var key = p.LastPaidCycleKey ?? "";
            DateTime at;
            if (key.Length == 7 && int.TryParse(key[..4], out var y) && int.TryParse(key[5..], out var m) && m is >= 1 and <= 12)
                at = new DateTime(y, m, Math.Min(Math.Max(p.DueDay, 1), DateTime.DaysInMonth(y, m)), 12, 0, 0, DateTimeKind.Utc);
            else if (key.Length == 4 && int.TryParse(key, out var yy))
                at = p.CreatedAt.Year == yy ? p.CreatedAt : new DateTime(yy, 1, 1, 12, 0, 0, DateTimeKind.Utc);
            else
                at = p.NextDueDate ?? p.CreatedAt;
            return at > now ? now : at;
        }

        // "Geri al" tostu için — MarkPaidAsync'in tersi, aynı kullanıcı/kayıt kısıtı.
        public async Task<Payment?> UnmarkPaidAsync(int userId, int paymentId)
        {
            var payment = await _db.Payments.FirstOrDefaultAsync(p => p.Id == paymentId && p.UserId == userId);
            if (payment == null) return null;

            // "Geri al": o dönemin kaydı da gider — geçmiş, gerçekte ödenmeyeni göstermesin.
            var cycle = payment.LastPaidCycleKey;
            if (cycle != null)
                _db.PaymentRecords.RemoveRange(_db.PaymentRecords.Where(r => r.UserId == userId && r.PaymentId == paymentId && r.CycleKey == cycle));
            payment.LastPaidCycleKey = null;
            await _db.SaveChangesAsync();
            return Out(userId, payment);
        }
    }
}
