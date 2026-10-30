using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    public class AdminService : IAdminService
    {
        private readonly AppDbContext _context;
        private readonly IStoreMetricsService _storeMetrics;
        private const int BanReasonMaxLength = 200;

        public AdminService(AppDbContext context, IStoreMetricsService storeMetrics)
        {
            _context = context;
            _storeMetrics = storeMetrics;
        }

        // Denetim kaydını ekler; SaveChanges çağıranda yapılır ki kayıt, tetikleyen
        // değişiklikle aynı transaction'da kalsın (biri yazılıp diğeri yazılmasın).
        private void AddAudit(AdminIdentity admin, string action, string? targetType, int? targetUserId, string? targetName, string? details)
        {
            _context.AdminAuditLogs.Add(new AdminAuditLog
            {
                AdminId = admin.AdminId,
                AdminName = admin.AdminName,
                Action = action,
                TargetType = targetType,
                TargetUserId = targetUserId,
                TargetName = targetName,
                Details = details,
                CreatedAt = DateTime.UtcNow,
            });
        }

        /// <summary>Kullanıcı tablosu filtreleri (madde 9). Bilinmeyen anahtar = filtre yok.</summary>
        public static readonly string[] UserFilters = { "active", "unverified", "banned", "staff", "deleted" };

        public static IQueryable<User> ApplyUserFilter(IQueryable<User> q, string? filter, DateTime now) => filter switch
        {
            // Son 7 günde görülen, silinmemiş hesaplar.
            "active" => q.Where(u => u.DeletedAt == null && u.LastActiveAt != null && u.LastActiveAt >= now.AddDays(-7)),
            "unverified" => q.Where(u => u.DeletedAt == null && !u.IsEmailVerified),
            // Kalıcı ban VEYA süresi dolmamış süreli ban (süresi geçmiş süreli ban "banlı" değildir).
            "banned" => q.Where(u => u.IsBanned || (u.BannedUntil != null && u.BannedUntil > now)),
            "staff" => q.Where(u => u.DeletedAt == null && u.Role != "User"),
            "deleted" => q.Where(u => u.DeletedAt != null),
            _ => q,
        };

        /*
          ANALİZ KİTLESİ (2026-10-31, kullanıcı: "analizde adminler hariç olmalı ki analiz şaşmasın; test
          hesaplarımız da dahil olmamalı — veya seçenek olmalı dahil edip etmeme gibi").
          Varsayılan: normal kullanıcı (Role == User) dahil, ekip rolleri hariç. Süper admin her hesap
          için açıkça dahil/hariç diyebilir (User.AnalyticsInclude). İstatistik, ürün içgörüleri ve
          Analiz Merkezi'nin TÜM sayıları bu tek tanımdan geçer — biri unutulursa sayılar birbirini tutmaz.
        */
        public static IQueryable<User> Audience(IQueryable<User> users) =>
            users.Where(u => u.AnalyticsInclude == true || (u.AnalyticsInclude == null && u.Role == "User"));

        public static bool InAudience(bool? include, string role) => include ?? role == "User";

        public async Task<AdminActionResult> SetAnalyticsIncludeAsync(int id, bool? include, AdminIdentity admin)
        {
            var user = await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return AdminActionResult.NotFound;
            user.AnalyticsInclude = include;
            AddAudit(admin, "analytics", "user", id, user.Name, include == null ? "varsayılan" : include.Value ? "dahil" : "hariç");
            await _context.SaveChangesAsync();
            return AdminActionResult.Success;
        }

        public async Task<UserListResult> GetUsersAsync(int page, int pageSize, string? search, string? sort, bool asc, string? filter = null)
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 30;

            var q = _context.Users.IgnoreQueryFilters().AsQueryable(); // soft-delete'liler dahil
            if (!string.IsNullOrWhiteSpace(search))
            {
                // ToLowerInvariant şart: makine kültürü tr-TR olduğunda "MELIH".ToLower()
                // "melıh" (noktasız ı) üretir ve "melih" ile eşleşmez. Arama terimi burada,
                // .NET tarafında küçültülürken sütun DB'de LOWER() ile küçültülür; iki taraf
                // farklı kurallar uygularsa büyük "I" içeren aramalar sessizce boş döner.
                var s = search.Trim().ToLowerInvariant();
                q = q.Where(u => u.Name.ToLower().Contains(s) || u.Email.ToLower().Contains(s));
            }

            // Çip sayıları aramaya uyanlar üzerinden, filtreden ÖNCE (her çip kendi sayısını gösterir).
            var now = DateTime.UtcNow;
            Dictionary<string, int>? counts = null;
            if (page == 1)
            {
                counts = new Dictionary<string, int>();
                foreach (var f in UserFilters) counts[f] = await ApplyUserFilter(q, f, now).CountAsync();
            }
            q = ApplyUserFilter(q, filter, now);

            var total = await q.CountAsync();

            /*
              Sunucu tarafında sıralama — sonunda `ThenBy(Id)` ile KARARLI hale getiriliyor.

              Buradaki her ölçütte eşitlik çok olası: aynı ada sahip kullanıcılar, 0 görevli
              kullanıcılar, hiç odak oturumu olmayanlar (varsayılan sıralama `Max(StartedAt)`
              kullanıyor ve bu, oturumu olmayan herkeste NULL). Eşit satırların sırası SQL'de
              tanımsızdır; "daha fazla yükle" ile sayfa sayfa ilerlerken aynı kullanıcı iki
              kez listelenir, bir başkası ise hiç görünmez.
            */
            var ordered = sort switch
            {
                "name" => asc ? q.OrderBy(u => u.Name) : q.OrderByDescending(u => u.Name),
                "tasks" => asc
                    ? q.OrderBy(u => _context.Tasks.Count(t => t.UserId == u.Id))
                    : q.OrderByDescending(u => _context.Tasks.Count(t => t.UserId == u.Id)),
                "focus" => asc
                    ? q.OrderBy(u => _context.FocusSessions.Where(f => f.UserId == u.Id).Sum(f => (int?)f.DurationMinutes) ?? 0)
                    : q.OrderByDescending(u => _context.FocusSessions.Where(f => f.UserId == u.Id).Sum(f => (int?)f.DurationMinutes) ?? 0),
                // recent — gerçek son görülme (LastActiveAt), yalnız odak oturumu değil
                _ => asc
                    ? q.OrderBy(u => u.LastActiveAt)
                    : q.OrderByDescending(u => u.LastActiveAt),
            };
            q = ordered.ThenBy(u => u.Id);

            var users = await q
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(u => new UserListItem(
                    u.Id,
                    u.Name,
                    u.Email,
                    u.Role,
                    u.IsBanned,
                    u.BannedUntil,
                    u.BanReason,
                    u.DeletedAt,
                    u.ProfilePicture,
                    u.LastLoginIp,
                    _context.Tasks.Count(t => t.UserId == u.Id),
                    _context.Tasks.Count(t => t.UserId == u.Id && t.IsCompleted),
                    _context.FocusSessions.Where(f => f.UserId == u.Id).Sum(f => (int?)f.DurationMinutes) ?? 0,
                    u.LastActiveAt,
                    u.AnalyticsInclude,
                    u.AnalyticsInclude == true || (u.AnalyticsInclude == null && u.Role == "User")))
                .ToListAsync();

            return new UserListResult(users, total, counts);
        }

        /// <summary>
        /// Sürüm dağılımı sorgusu. Kayıt (record) kurucusunun ÜRETTİĞİ alana göre sıralamak
        /// (`Select(new VersionShare(..)).OrderByDescending(v => v.Users)`) Npgsql'de SQL'e
        /// çevrilemiyordu → /product-insights canlıda 500; panel hatayı yutup kartı boş bırakıyordu
        /// (InMemory testleri istemcide çalıştırdığı için görmedi). Önce say + sırala, sonra kur.
        /// </summary>
        public static IQueryable<VersionShare> VersionShareQuery(IQueryable<User> users) => users
            .Where(u => u.LastKnownAppVersion != null)
            .GroupBy(u => u.LastKnownAppVersion)
            .Select(g => new { Version = g.Key!, Users = g.Count() })
            .OrderByDescending(x => x.Users)
            .Select(x => new VersionShare(x.Version, x.Users));

        public async Task<AudienceStats> GetAudienceAsync()
        {
            var now = DateTime.UtcNow;

            var liveUsers = _context.Users.Where(u => u.DeletedAt == null);
            var registered = new RegisteredAudience(
                Total: await liveUsers.CountAsync(),
                EmailVerified: await liveUsers.CountAsync(u => u.IsEmailVerified),
                Deleted: await _context.Users.CountAsync(u => u.DeletedAt != null));

            var installs = _context.AppInstalls;
            var installAudience = new InstallAudience(
                Total: await installs.CountAsync(),
                ActiveLast7Days: await installs.CountAsync(i => i.LastSeenAt >= now.AddDays(-7)),
                ActiveLast30Days: await installs.CountAsync(i => i.LastSeenAt >= now.AddDays(-30)));

            return new AudienceStats(registered, installAudience,
                _storeMetrics.AppStore(), _storeMetrics.PlayStore());
        }

        public async Task<AdminStats> GetStatsAsync()
        {
            var now = DateTime.UtcNow;
            var todayStart = now.Date;
            var weekStart = now.Date.AddDays(-7);

            // Yalnız analiz kitlesi (bkz. Audience): ekip ve test hesapları sayıları şaşırtmasın.
            var people = Audience(_context.Users);
            var ids = people.Select(u => u.Id);
            var tasksQ = _context.Tasks.Where(t => ids.Contains(t.UserId));
            var focusQ = _context.FocusSessions.Where(f => ids.Contains(f.UserId));
            var totalUsers = await people.CountAsync();
            var totalTasks = await tasksQ.CountAsync();
            var completedTasks = await tasksQ.CountAsync(t => t.IsCompleted);
            var totalFocusMinutes = await focusQ.SumAsync(f => (int?)f.DurationMinutes) ?? 0;
            var activeToday = await focusQ
                .Where(f => f.StartedAt >= todayStart)
                .Select(f => f.UserId).Distinct().CountAsync();
            var activeThisWeek = await focusQ
                .Where(f => f.StartedAt >= weekStart)
                .Select(f => f.UserId).Distinct().CountAsync();
            var sessionsToday = await focusQ.CountAsync(f => f.StartedAt >= todayStart);

            // Günlük odak trendi — son 7 gün
            var sessions = await focusQ
                .Where(f => f.StartedAt >= weekStart) // yarım kalan seansın süresi de odak (haftalık geri bakışla aynı)
                .ToListAsync();

            var dailyTrend = Enumerable.Range(0, 7).Select(i =>
            {
                var day = now.Date.AddDays(-6 + i);
                return new DailyTrendPoint(
                    day.ToString("ddd"),
                    sessions.Where(s => s.StartedAt.Date == day).Sum(s => s.DurationMinutes),
                    day.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));
            }).ToList();

            // Haftalık kıyas: son 7 gün vs önceki 7 gün.
            var prevStart = weekStart.AddDays(-7);
            var seenToday = await people.CountAsync(u => u.LastActiveAt >= todayStart);
            var seen7d = await people.CountAsync(u => u.LastActiveAt >= weekStart);
            var newUsers7d = await people.CountAsync(u => u.CreatedAt >= weekStart);
            var newUsersPrev7d = await people.CountAsync(u => u.CreatedAt >= prevStart && u.CreatedAt < weekStart);
            var focus7d = sessions.Sum(s => s.DurationMinutes);
            var focusPrev7d = await focusQ
                .Where(f => f.StartedAt >= prevStart && f.StartedAt < weekStart)
                .SumAsync(f => (int?)f.DurationMinutes) ?? 0;

            return new AdminStats(totalUsers, totalTasks, completedTasks, totalFocusMinutes,
                activeToday, activeThisWeek, sessionsToday, dailyTrend,
                seenToday, seen7d, newUsers7d, newUsersPrev7d, focus7d, focusPrev7d);
        }

        // Dönemsel mod ailesi → `seasonal` içindeki AÇIK BAYRAK alanı. Ramazan'ın adı
        // "ramazanMode" değil "ramazan" — istisna elle burada, JSON'un kendi biçimi bu.
        private static readonly (string Family, string SeasonalFlag)[] ModeFamilies =
        {
            ("exam", "examMode"), ("tez", "tezMode"), ("mulakat", "mulakatMode"),
            ("spor", "sporMode"), ("ramazan", "ramazan"),
            ("tasarruf", "tasarrufMode"), ("birakma", "birakmaMode"),
        };

        // goalHistory'deki yuva adları ikinci/üçüncü slotlu olabilir (exam2, spor3…);
        // aile bazında toplamak için sondaki rakam atılır.
        private static string FamilyOf(string slotKey) => slotKey.TrimEnd('2', '3');

        /// <summary>Tercih JSON'unda açık bir dönemsel mod ya da kapanmış hedef var mı (analiz: mod benimseme).</summary>
        public static bool UsesAnyMode(string preferencesJson)
        {
            try
            {
                using var doc = JsonDocument.Parse(preferencesJson);
                var root = doc.RootElement;
                if (root.ValueKind != JsonValueKind.Object) return false;
                if (root.TryGetProperty("seasonal", out var seasonal) && seasonal.ValueKind == JsonValueKind.Object
                    && ModeFamilies.Any(m => seasonal.TryGetProperty(m.SeasonalFlag, out var v) && v.ValueKind == JsonValueKind.True))
                    return true;
                return root.TryGetProperty("goalHistory", out var h) && h.ValueKind == JsonValueKind.Array && h.GetArrayLength() > 0;
            }
            catch (JsonException) { return false; }
        }

        /// <summary>
        /// Ürün içgörüleri — dönemsel mod benimsenmesi, elde tutma (retention), sürüm dağılımı.
        ///
        /// Mod verisi `User.Preferences` (bulut senkronu, düz JSON) içinde yaşıyor — ayrı
        /// bir tablo yok. Bu yüzden burada satır satır JSON ayrıştırılıyor; TEK bozuk kayıt
        /// tüm sorguyu düşürmesin diye her kullanıcı kendi try/catch'inde.
        /// </summary>
        public async Task<ProductInsights> GetProductInsightsAsync()
        {
            var people = Audience(_context.Users); // ekip/test hariç (bkz. Audience)
            var totalUsers = await people.CountAsync();

            // ── Mod benimsenmesi ────────────────────────────────────────────────
            var prefsBlobs = await people
                .Where(u => u.Preferences != null)
                .Select(u => u.Preferences!)
                .ToListAsync();

            var activeCounts = ModeFamilies.ToDictionary(m => m.Family, _ => 0);
            var closedCounts = ModeFamilies.ToDictionary(m => m.Family, _ => 0);
            var durationSums = ModeFamilies.ToDictionary(m => m.Family, _ => (Sum: 0.0, Count: 0));
            var effortSums = ModeFamilies.ToDictionary(m => m.Family, _ => (Sum: 0.0, Count: 0));

            foreach (var blob in prefsBlobs)
            {
                try
                {
                    using var doc = JsonDocument.Parse(blob);
                    var root = doc.RootElement;

                    if (root.TryGetProperty("seasonal", out var seasonal) && seasonal.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var (family, flag) in ModeFamilies)
                        {
                            if (seasonal.TryGetProperty(flag, out var v) && v.ValueKind == JsonValueKind.True)
                                activeCounts[family]++;
                        }
                    }

                    if (root.TryGetProperty("goalHistory", out var history) && history.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var rec in history.EnumerateArray())
                        {
                            if (!rec.TryGetProperty("mode", out var modeEl) || modeEl.ValueKind != JsonValueKind.String) continue;
                            var family = FamilyOf(modeEl.GetString() ?? "");
                            if (!closedCounts.ContainsKey(family)) continue;

                            closedCounts[family]++;
                            if (rec.TryGetProperty("days", out var daysEl) && daysEl.ValueKind == JsonValueKind.Number)
                            {
                                var (sum, count) = durationSums[family];
                                durationSums[family] = (sum + daysEl.GetDouble(), count + 1);
                            }
                            if (rec.TryGetProperty("effortDays", out var effEl) && effEl.ValueKind == JsonValueKind.Number)
                            {
                                var (sum, count) = effortSums[family];
                                effortSums[family] = (sum + effEl.GetDouble(), count + 1);
                            }
                        }
                    }
                }
                catch (JsonException)
                {
                    // Bozuk/eski biçim tek satırı etkiler, sorguyu düşürmez.
                }
            }

            var modes = ModeFamilies.Select(m =>
            {
                var (durSum, durCount) = durationSums[m.Family];
                var (effSum, effCount) = effortSums[m.Family];
                return new ModeAdoption(
                    m.Family,
                    activeCounts[m.Family],
                    closedCounts[m.Family],
                    durCount > 0 ? Math.Round(durSum / durCount, 1) : null,
                    effCount > 0 ? Math.Round(effSum / effCount, 1) : null);
            }).ToList();

            // ── Elde tutma (retention) — son 8 kayıt haftası ────────────────────
            var now = DateTime.UtcNow;
            var cohortRows = await people
                .Select(u => new { u.CreatedAt, u.LastActiveAt })
                .ToListAsync();

            var retention = new List<RetentionCohort>();
            for (var i = 7; i >= 0; i--)
            {
                var weekStart = now.Date.AddDays(-7 * (i + 1));
                var weekEnd = now.Date.AddDays(-7 * i);
                // Kohort yalnız kayıttan en az 7 gün geçmişse anlamlı — yoksa "henüz aktif
                // olma şansı bile olmayan" biri "kaybedildi" sayılır.
                if (weekEnd.AddDays(7) > now) continue;

                var cohort = cohortRows.Where(u => u.CreatedAt >= weekStart && u.CreatedAt < weekEnd).ToList();
                if (cohort.Count == 0) continue;

                var stillActive = cohort.Count(u => u.LastActiveAt.HasValue && u.LastActiveAt.Value >= u.CreatedAt.AddDays(7));
                retention.Add(new RetentionCohort(weekStart.ToString("dd MMM"), cohort.Count, stillActive,
                    weekStart.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture)));
            }

            // ── Sürüm dağılımı ───────────────────────────────────────────────────
            var versions = await VersionShareQuery(people).ToListAsync();
            var usersWithKnownVersion = versions.Sum(v => v.Users);

            return new ProductInsights(modes, prefsBlobs.Count, retention, versions, usersWithKnownVersion, totalUsers);
        }

        public async Task<AdminActionResult> DeleteUserAsync(int id, AdminIdentity admin)
        {
            if (id == admin.AdminId) return AdminActionResult.SelfActionForbidden;

            var user = await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return AdminActionResult.NotFound;

            // Kalıcı silme: kullanıcıya ait tüm ilişkili veriyi de temizle (FK ihlali olmasın).
            // Tek SaveChanges → EF hepsini tek transaction'da yazar; yarım silme oluşmaz.
            _context.Tasks.RemoveRange(_context.Tasks.Where(t => t.UserId == id));
            _context.FocusSessions.RemoveRange(_context.FocusSessions.Where(f => f.UserId == id));
            _context.RefreshTokens.RemoveRange(_context.RefreshTokens.Where(t => t.UserId == id));
            _context.SupportMessages.RemoveRange(_context.SupportMessages.Where(m => m.UserId == id));
            _context.PasswordResetTokens.RemoveRange(_context.PasswordResetTokens.Where(p => p.UserId == id));
            _context.UserNotificationPreferences.RemoveRange(_context.UserNotificationPreferences.Where(p => p.UserId == id));
            _context.ClientCrashes.RemoveRange(_context.ClientCrashes.Where(c => c.UserId == id));
            _context.BanHistories.RemoveRange(_context.BanHistories.Where(b => b.UserId == id));
            _context.Users.Remove(user);

            AddAudit(admin, "delete_user", "user", id, user.Name, $"Kalıcı silme (hard delete) · {user.Email}");
            await _context.SaveChangesAsync();
            return AdminActionResult.Success;
        }

        public async Task<AdminActionResult> SetRoleAsync(int id, string role, AdminIdentity admin)
        {
            if (id == admin.AdminId) return AdminActionResult.SelfActionForbidden;
            // Serbest metin rol yazılamaz: yalnız tanımlı roller (bkz. StaffRoles).
            if (!Tazq_App.Authorization.StaffRoles.IsValid(role)) return AdminActionResult.InvalidInput;

            var user = await _context.Users.FindAsync(id);
            if (user == null) return AdminActionResult.NotFound;

            var oldRole = user.Role;
            user.Role = role;
            AddAudit(admin, "role_change", "user", id, user.Name, $"{oldRole} → {role}");
            await _context.SaveChangesAsync();
            return AdminActionResult.Success;
        }

        public async Task<(AdminActionResult Result, User? User)> SetBanAsync(int id, bool banned, int? durationDays, string? reason, AdminIdentity admin)
        {
            if (id == admin.AdminId) return (AdminActionResult.SelfActionForbidden, null);

            var user = await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return (AdminActionResult.NotFound, null);

            var record = new BanHistory
            {
                UserId = id,
                Action = banned ? "ban" : "unban",
                AdminId = admin.AdminId,
                AdminName = admin.AdminName,
                CreatedAt = DateTime.UtcNow,
            };

            if (banned)
            {
                var cleanReason = string.IsNullOrWhiteSpace(reason) ? "Belirtilmedi" : reason.Trim();
                if (cleanReason.Length > BanReasonMaxLength) cleanReason = cleanReason.Substring(0, BanReasonMaxLength);

                if (durationDays.HasValue && durationDays.Value > 0)
                {
                    // Süreli ban: süre dolunca otomatik kalkar
                    user.IsBanned = false;
                    user.BannedUntil = DateTime.UtcNow.AddDays(durationDays.Value);
                }
                else
                {
                    // Kalıcı ban
                    user.IsBanned = true;
                    user.BannedUntil = null;
                }
                user.BanReason = cleanReason;
                record.Reason = cleanReason;
                record.DurationDays = durationDays;
                record.BannedUntil = user.BannedUntil;

                // Banlanınca tüm aktif refresh token'ları iptal et — oturumları kısa sürede düşer
                var now = DateTime.UtcNow;
                var tokens = await _context.RefreshTokens
                    .Where(t => t.UserId == id && t.RevokedAt == null)
                    .ToListAsync();
                foreach (var t in tokens) t.RevokedAt = now;
            }
            else
            {
                // Banı kaldır
                user.IsBanned = false;
                user.BannedUntil = null;
                user.BanReason = null;
            }

            _context.BanHistories.Add(record);
            var auditDetail = banned
                ? $"{record.Reason} · {(durationDays.HasValue && durationDays.Value > 0 ? $"{durationDays} gün" : "kalıcı")}"
                : "Ban kaldırıldı";
            AddAudit(admin, banned ? "ban" : "unban", "user", id, user.Name, auditDetail);
            await _context.SaveChangesAsync();
            return (AdminActionResult.Success, user);
        }

        public async Task<List<BanHistory>> GetBanHistoryAsync(int id)
            => await _context.BanHistories
                .Where(b => b.UserId == id)
                .OrderByDescending(b => b.CreatedAt)
                .Take(50)
                .AsNoTracking()
                .ToListAsync();

        public async Task<User?> GetUserWithDetailAsync(int id)
            => await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id);

        public async Task<List<TaskItem>> GetRecentTasksAsync(int userId, int take)
            => await _context.Tasks.Where(t => t.UserId == userId)
                .OrderByDescending(t => t.Id).Take(take).AsNoTracking().ToListAsync();

        public async Task<List<FocusSession>> GetRecentSessionsAsync(int userId, int take)
            => await _context.FocusSessions.Where(f => f.UserId == userId)
                .OrderByDescending(f => f.StartedAt).Take(take).AsNoTracking().ToListAsync();

        public async Task<List<RefreshToken>> GetRecentDevicesAsync(int userId, int take)
            => await _context.RefreshTokens.Where(t => t.UserId == userId)
                .OrderByDescending(t => t.CreatedAt).Take(take).AsNoTracking().ToListAsync();

        public async Task<UserExport?> ExportUserAsync(int id, AdminIdentity admin)
        {
            var user = await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return null;

            var tasks = await _context.Tasks.AsNoTracking().Where(t => t.UserId == id).ToListAsync();
            var sessions = await _context.FocusSessions.AsNoTracking().Where(f => f.UserId == id).ToListAsync();
            var support = await _context.SupportMessages.AsNoTracking().Where(m => m.UserId == id).ToListAsync();
            var bans = await _context.BanHistories.AsNoTracking().Where(b => b.UserId == id).ToListAsync();

            // KVKK ihracı denetim kaydı gerektirir — kim, kimin verisini, ne zaman aldı.
            AddAudit(admin, "export", "user", id, user.Name, $"KVKK veri ihracı · {user.Email}");
            await _context.SaveChangesAsync();

            return new UserExport(user, tasks, sessions, support, bans);
        }

        public async Task<(List<AdminAuditLog> Items, int Total)> GetAuditLogPageAsync(int limit, int offset)
        {
            limit = Math.Clamp(limit, 1, 200);
            offset = Math.Max(offset, 0);

            var q = _context.AdminAuditLogs.AsNoTracking();
            var total = await q.CountAsync();
            var items = await q
                // Eşitlik bozucu: aynı saniyeye düşen kayıtlar (toplu ekleme, çökme dalgası)
                // sıralamada tanımsız kalır ve sayfalar arasında yer değiştirir. Id benzersiz.
                .OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id)
                .Skip(offset)
                .Take(limit)
                .ToListAsync();

            return (items, total);
        }
    }
}
