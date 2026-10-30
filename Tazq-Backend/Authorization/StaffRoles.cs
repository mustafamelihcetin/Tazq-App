using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;

namespace Tazq_App.Authorization
{
    /// <summary>
    /// Ekip rolleri (madde 9 — RBAC, 2026-10-30).
    ///
    /// En az yetki (kullanıcı: "bir yetkili mesela userları göremesin, rolleri iyi ayır"):
    ///   Support   = YALNIZ destek kutusu (oku, yanıtla, okundu). Kullanıcı listesi yok.
    ///   Analyst   = Ürün Analisti: Analiz Merkezi (istatistik, segment, huni, benimseme, odak
    ///               davranışı, kararlılık). KİŞİ LİSTESİ YOK — "kim" değil "kaç kişi, ne yapıyor".
    ///               Müdahale yok, teknik kısım yok.
    ///   Moderator = kullanıcı listesi, ban/ban kaldırma, ban geçmişi, destek kutusu + mesaj silme.
    ///   Admin     = süper admin: + kişisel detay (IP, telefon, görevler), dışa aktarma, silme,
    ///               rol verme, istatistik, denetim kaydı, sistem, çökmeler, içerik.
    ///
    /// Roller bir merdiven DEĞİL (Analist istatistik görür, Moderatör görmez): her politika
    /// kendi rol kümesini açıkça sayar.
    /// "Admin" adı mevcut veri ve tokenlarla uyum için korunur; ekranda "Süper admin" yazar.
    /// </summary>
    public static class StaffRoles
    {
        public const string User = "User";
        public const string Support = "Support";
        public const string Analyst = "Analyst";
        public const string Moderator = "Moderator";
        public const string Admin = "Admin";

        public static readonly string[] All = { User, Support, Analyst, Moderator, Admin };
        public static bool IsValid(string? role) => role != null && All.Contains(role);

    }

    /// <summary>Uç noktaların istediği yetki. Bir eylemde sınıf + eylem politikası KESİŞİR.</summary>
    public static class StaffPolicy
    {
        public const string SupportDesk = "SupportDesk";     // Support, Moderator, Admin
        public const string Insights = "Insights";           // Analyst, Admin
        public const string Moderation = "Moderation";       // Moderator, Admin
        public const string SuperAdmin = "SuperAdmin";       // Admin

        public static void Register(AuthorizationOptions opt)
        {
            void Add(string name, params string[] roles) =>
                opt.AddPolicy(name, p => p.RequireAuthenticatedUser().AddRequirements(new StaffRoleRequirement(roles)));
            Add(SupportDesk, StaffRoles.Support, StaffRoles.Moderator, StaffRoles.Admin);
            Add(Insights, StaffRoles.Analyst, StaffRoles.Admin);
            Add(Moderation, StaffRoles.Moderator, StaffRoles.Admin);
            Add(SuperAdmin, StaffRoles.Admin);
        }
    }

    public sealed class StaffRoleRequirement : IAuthorizationRequirement
    {
        public IReadOnlyCollection<string> Roles { get; }
        public StaffRoleRequirement(params string[] roles) => Roles = roles;
    }

    /// <summary>
    /// Rol JWT'den DEĞİL veritabanından okunur. Token 7 gün geçerli; JWT'deki rol iddiasına
    /// güvenmek, yetkisi alınan (ya da banlanan/silinen) bir ekip üyesinin bir hafta daha
    /// panele girebilmesi demekti. Ekip uçları az çağrılır; istek başına tek indeksli sorgu ucuz.
    /// </summary>
    public sealed class StaffRoleHandler : AuthorizationHandler<StaffRoleRequirement>
    {
        private readonly AppDbContext _db;
        public StaffRoleHandler(AppDbContext db) => _db = db;

        protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, StaffRoleRequirement requirement)
        {
            var role = await CurrentStaffRoleAsync(_db, context.User);
            if (role != null && requirement.Roles.Contains(role)) context.Succeed(requirement);
        }

        /// <summary>
        /// İsteği yapanın GÜNCEL rolü (DB); banlı/silinmiş/bulunamayan → null.
        /// Controller'lar da maskeleme kararını buna dayandırır (token'daki eski rol değil).
        /// </summary>
        public static async Task<string?> CurrentStaffRoleAsync(AppDbContext db, ClaimsPrincipal user)
        {
            if (!int.TryParse(user.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id)) return null;

            // Silinmiş hesaplar global sorgu filtresiyle zaten gelmez.
            var row = await db.Users.AsNoTracking()
                .Where(u => u.Id == id)
                .Select(u => new { u.Role, u.IsBanned, u.BannedUntil })
                .FirstOrDefaultAsync();
            if (row == null) return null;
            if (row.IsBanned || (row.BannedUntil.HasValue && row.BannedUntil.Value > DateTime.UtcNow)) return null;
            return row.Role;
        }
    }
}
