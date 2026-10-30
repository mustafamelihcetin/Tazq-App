using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tazq_App.Authorization;
using Tazq_App.Controllers;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;
using Xunit;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// Ekip rolleri (madde 9): Destek · Ürün Analisti · Moderatör · Süper admin. Roller merdiven değil,
    /// her politika kendi rol kümesini sayar. Rol JWT'den değil DB'den okunur; her ekip ucunun hangi
    /// yetkiyi istediği burada sabitlenir (yanlışlıkla gevşetilmesin).
    /// </summary>
    public class StaffAuthorizationTests
    {
        private static AppDbContext NewDb() => new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

        private static ClaimsPrincipal Principal(int id, string jwtRole = "User") => new(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, id.ToString()),
            new Claim(ClaimTypes.Role, jwtRole),
        }, "test"));

        private static async Task<bool> Allowed(AppDbContext db, ClaimsPrincipal user, string policy)
        {
            var opts = new AuthorizationOptions();
            StaffPolicy.Register(opts);
            var req = opts.GetPolicy(policy)!.Requirements.OfType<StaffRoleRequirement>().Single();
            var ctx = new AuthorizationHandlerContext(new[] { req }, user, null);
            await new StaffRoleHandler(db).HandleAsync(ctx);
            return ctx.HasSucceeded;
        }

        private static async Task<AppDbContext> Seed(params User[] users)
        {
            var db = NewDb();
            db.Users.AddRange(users);
            await db.SaveChangesAsync();
            return db;
        }

        // Sütunlar: SupportDesk, Insights, Moderation, SuperAdmin
        [Theory]
        [InlineData("User", false, false, false, false)]
        [InlineData("Support", true, false, false, false)]
        [InlineData("Analyst", false, true, false, false)]
        [InlineData("Moderator", true, false, true, false)]
        [InlineData("Admin", true, true, true, true)]
        public async Task RoleMatrix(string role, bool desk, bool insights, bool moderation, bool super)
        {
            var db = await Seed(new User { Id = 5, Email = "a@t.com", Name = "A", Role = role });
            Assert.Equal(desk, await Allowed(db, Principal(5), StaffPolicy.SupportDesk));
            Assert.Equal(insights, await Allowed(db, Principal(5), StaffPolicy.Insights));
            Assert.Equal(moderation, await Allowed(db, Principal(5), StaffPolicy.Moderation));
            Assert.Equal(super, await Allowed(db, Principal(5), StaffPolicy.SuperAdmin));
        }

        [Fact]
        public async Task StaleJwtRole_IsIgnored_DbRoleWins()
        {
            // Yetkisi alınmış eski admin: token hâlâ "Admin" diyor, DB "User".
            var db = await Seed(new User { Id = 5, Email = "a@t.com", Name = "A", Role = "User" });
            Assert.False(await Allowed(db, Principal(5, jwtRole: "Admin"), StaffPolicy.SupportDesk));
            Assert.False(await Allowed(db, Principal(5, jwtRole: "Admin"), StaffPolicy.Insights));
        }

        [Fact]
        public async Task BannedOrDeletedStaff_IsDenied()
        {
            var db = await Seed(
                new User { Id = 1, Email = "b@t.com", Name = "B", Role = "Admin", IsBanned = true },
                new User { Id = 2, Email = "c@t.com", Name = "C", Role = "Admin", BannedUntil = DateTime.UtcNow.AddDays(1) },
                new User { Id = 3, Email = "d@t.com", Name = "D", Role = "Admin", DeletedAt = DateTime.UtcNow });
            foreach (var id in new[] { 1, 2, 3 })
                Assert.False(await Allowed(db, Principal(id), StaffPolicy.Insights));
        }

        [Fact]
        public async Task SetRole_RejectsUnknownRole()
        {
            var db = await Seed(new User { Id = 2, Email = "u@t.com", Name = "U", Role = "User" });
            var svc = new AdminService(db, new Moq.Mock<IStoreMetricsService>().Object);
            Assert.Equal(AdminActionResult.InvalidInput, await svc.SetRoleAsync(2, "Root", new AdminIdentity(1, "A")));
            Assert.Equal(AdminActionResult.Success, await svc.SetRoleAsync(2, StaffRoles.Analyst, new AdminIdentity(1, "A")));
            Assert.Equal("Analyst", (await db.Users.FindAsync(2))!.Role);
        }

        // ── Uç → yetki haritası ─────────────────────────────────────────────────

        /// <summary>Bir eylemin etkin politikaları: sınıf + eylem (ASP.NET ikisini KESİŞTİRİR).</summary>
        private static HashSet<string> Policies(Type controller, string action)
        {
            var m = controller.GetMethod(action, BindingFlags.Public | BindingFlags.Instance)!;
            return controller.GetCustomAttributes<AuthorizeAttribute>().Concat(m.GetCustomAttributes<AuthorizeAttribute>())
                .Where(a => a.Policy != null).Select(a => a.Policy!).ToHashSet();
        }

        [Theory]
        // Destek kutusu: Destek, Moderatör, Admin.
        [InlineData(typeof(SupportController), nameof(SupportController.GetAllMessages), StaffPolicy.SupportDesk)]
        [InlineData(typeof(SupportController), nameof(SupportController.ReplyMessage), StaffPolicy.SupportDesk)]
        [InlineData(typeof(SupportController), nameof(SupportController.MarkAsRead), StaffPolicy.SupportDesk)]
        [InlineData(typeof(SupportController), nameof(SupportController.DeleteMessage), StaffPolicy.Moderation)]
        [InlineData(typeof(SupportController), nameof(SupportController.GetTemplates), StaffPolicy.SupportDesk)]
        [InlineData(typeof(SupportController), nameof(SupportController.SaveTemplates), StaffPolicy.Moderation)]
        // Analiz: Ürün Analisti + Admin. Kişi listesi YOK.
        [InlineData(typeof(AdminController), nameof(AdminController.GetAnalytics), StaffPolicy.Insights)]
        [InlineData(typeof(AdminController), nameof(AdminController.GetStats), StaffPolicy.Insights)]
        [InlineData(typeof(AdminController), nameof(AdminController.GetAudience), StaffPolicy.Insights)]
        [InlineData(typeof(AdminController), nameof(AdminController.GetProductInsights), StaffPolicy.Insights)]
        // Kullanıcılar ve müdahale: Moderatör + Admin.
        [InlineData(typeof(AdminController), nameof(AdminController.GetUsers), StaffPolicy.Moderation)]
        [InlineData(typeof(AdminController), nameof(AdminController.SetBan), StaffPolicy.Moderation)]
        [InlineData(typeof(AdminController), nameof(AdminController.GetBanHistory), StaffPolicy.Moderation)]
        // Süper admin: kişisel veri, geri dönüşsüz/toplu işlem, teknik kayıt.
        [InlineData(typeof(AdminController), nameof(AdminController.GetUserDetail), StaffPolicy.SuperAdmin)]
        [InlineData(typeof(AdminController), nameof(AdminController.SetRole), StaffPolicy.SuperAdmin)]
        [InlineData(typeof(AdminController), nameof(AdminController.DeleteUser), StaffPolicy.SuperAdmin)]
        [InlineData(typeof(AdminController), nameof(AdminController.ExportUser), StaffPolicy.SuperAdmin)]
        [InlineData(typeof(AdminController), nameof(AdminController.GetAuditLog), StaffPolicy.SuperAdmin)]
        [InlineData(typeof(SupportController), nameof(SupportController.GetCrashes), StaffPolicy.SuperAdmin)]
        [InlineData(typeof(SupportController), nameof(SupportController.ResolveCrash), StaffPolicy.SuperAdmin)]
        [InlineData(typeof(ContentController), nameof(ContentController.Upsert), StaffPolicy.SuperAdmin)]
        public void Endpoint_RequiresPolicies(Type controller, string action, params string[] policies)
            => Assert.Equal(policies.ToHashSet(), Policies(controller, action));

        [Fact]
        public void EveryAdminAction_DeclaresAStaffPolicy()
        {
            // Sınıf düzeyi yalnız [Authorize] (oturum). Politikasız yeni bir eylem her oturum açmış
            // KULLANICIYA açık olurdu — kapalı-varsayılan bekçisi.
            var naked = typeof(AdminController).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                .Where(m => m.GetCustomAttributes().Any(a => a is Microsoft.AspNetCore.Mvc.Routing.HttpMethodAttribute))
                .Where(m => !m.GetCustomAttributes<AuthorizeAttribute>().Any(a => a.Policy != null))
                .Select(m => m.Name).ToList();
            Assert.Empty(naked);
        }

        [Fact]
        public void SystemConsole_IsSuperAdminOnly_AndNoLegacyRoleAttributesRemain()
        {
            Assert.Contains(StaffPolicy.SuperAdmin, typeof(AdminSystemController).GetCustomAttributes<AuthorizeAttribute>().Select(a => a.Policy));
            // JWT rol iddiasına dayanan eski [Authorize(Roles = ...)] kalmamalı: tek doğruluk kaynağı DB.
            var legacy = typeof(AdminController).Assembly.GetTypes()
                .Where(t => typeof(ControllerBase).IsAssignableFrom(t))
                .SelectMany(t => t.GetCustomAttributes<AuthorizeAttribute>().Concat(t.GetMethods().SelectMany(m => m.GetCustomAttributes<AuthorizeAttribute>()))
                    .Where(a => !string.IsNullOrEmpty(a.Roles)).Select(a => t.Name))
                .ToList();
            Assert.Empty(legacy);
        }
    }
}
