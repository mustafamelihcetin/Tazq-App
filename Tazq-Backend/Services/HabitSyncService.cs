using System.Text.Json;
using Tazq_App.Data;

namespace Tazq_App.Services
{
    /// <summary>
    /// ALIŞKANLIK EŞİTLEMESİ — istemcinin alışkanlık listesinin şifreli kopyası.
    ///
    /// Şema istemcinindir (useHabitStore); sunucu içeriği yorumlamaz, yalnız bir JSON DİZİSİ
    /// olduğunu doğrular ve kullanıcı anahtarıyla şifreler (görev içerikleriyle aynı güvence).
    /// Birleştirme istemcide yapılır (bkz. habitsMerge.ts): giriş anında yerel ve bulut kopya
    /// kimliğe göre birleşir, sonuç geri yazılır.
    /// </summary>
    public class HabitSyncService : IHabitSyncService
    {
        private readonly AppDbContext _context;
        private readonly ICryptoService _crypto;
        private readonly ILogger<HabitSyncService> _logger;

        public HabitSyncService(AppDbContext context, ICryptoService crypto, ILogger<HabitSyncService> logger)
        {
            _context = context;
            _crypto = crypto;
            _logger = logger;
        }

        /// <summary>Yalnız JSON dizisi kabul edilir — yarım/bozuk yük bulut kopyasını ezmesin.</summary>
        public static bool IsValidPayload(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return false;
            try
            {
                using var doc = JsonDocument.Parse(json);
                return doc.RootElement.ValueKind == JsonValueKind.Array;
            }
            catch (JsonException)
            {
                return false;
            }
        }

        public async Task<HabitsSnapshot?> GetAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return null;
            if (string.IsNullOrEmpty(user.HabitsData)) return new HabitsSnapshot(null, user.HabitsUpdatedAt);

            var plain = TryDecrypt(user.HabitsData, userId);
            return new HabitsSnapshot(plain, user.HabitsUpdatedAt);
        }

        public async Task<bool> SaveAsync(int userId, string json)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return false;
            user.HabitsData = _crypto.Encrypt(json, _crypto.GetKeyForUser(userId));
            user.HabitsUpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        /// <summary>
        /// Önce güncel anahtar, sonra eski anahtarlar (anahtar döndürme sonrası). Hiçbiri tutmazsa
        /// veri "yok" sayılır ve loglanır — istemci yerel kopyasını korur, bir sonraki kayıtta
        /// güncel anahtarla yeniden yazılır. Asla istisna fırlatmaz.
        /// </summary>
        private string? TryDecrypt(string cipher, int userId)
        {
            try { return _crypto.Decrypt(cipher, _crypto.GetKeyForUser(userId)); }
            catch { /* eski anahtarları dene */ }
            foreach (var key in _crypto.GetLegacyKeysForUser(userId) ?? Array.Empty<byte[]>())
            {
                try { return _crypto.Decrypt(cipher, key); }
                catch { /* sıradaki */ }
            }
            _logger.LogWarning("Habit data for user {UserId} could not be decrypted with any key", userId);
            return null;
        }
    }
}
