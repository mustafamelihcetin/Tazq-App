using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tazq_App.Controllers;
using Tazq_App.Data;
using Tazq_App.Services;
using Xunit;

namespace Tazq_Backend.Tests
{
    /// <summary>Destek hazır yanıt şablonları: içerik deposunda iç anahtarla; açık içerik ucundan sızmaz.</summary>
    public class SupportTemplateTests
    {
        private static (ContentService Content, SupportTemplateService Svc) Make()
        {
            var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
            var content = new ContentService(db);
            return (content, new SupportTemplateService(content));
        }

        [Fact]
        public async Task NothingSaved_ReturnsDefaults()
        {
            var (_, svc) = Make();
            var list = await svc.GetAsync();
            Assert.True(list.Count >= 5);
            Assert.All(list, t => Assert.Contains("{ad}", t.Body));
        }

        [Fact]
        public async Task Save_TrimsAssignsIds_AndRoundTrips()
        {
            var (_, svc) = Make();
            var (saved, error) = await svc.SaveAsync(new() { new SupportTemplate("", "  Selam  ", "  Merhaba {ad}  ") });
            Assert.Null(error);
            var got = Assert.Single(await svc.GetAsync());
            Assert.Equal(("Selam", "Merhaba {ad}"), (got.Title, got.Body));
            Assert.False(string.IsNullOrWhiteSpace(got.Id));
            Assert.Equal(saved![0].Id, got.Id);
        }

        [Theory]
        [InlineData("", "metin")]
        [InlineData("başlık", "   ")]
        public async Task Save_RejectsEmptyParts(string title, string body)
        {
            var (_, svc) = Make();
            var (saved, error) = await svc.SaveAsync(new() { new SupportTemplate("x", title, body) });
            Assert.Null(saved);
            Assert.NotNull(error);
        }

        [Fact]
        public async Task Save_RejectsTooMany_AndTooLong()
        {
            var (_, svc) = Make();
            var many = Enumerable.Range(0, SupportTemplateService.MaxTemplates + 1).Select(i => new SupportTemplate($"{i}", "t", "b")).ToList();
            Assert.Null((await svc.SaveAsync(many)).Saved);
            Assert.Null((await svc.SaveAsync(new() { new SupportTemplate("x", "t", new string('a', SupportTemplateService.MaxBody + 1)) })).Saved);
        }

        [Fact]
        public async Task PublicContentEndpoint_NeverReturnsInternalKeys()
        {
            var (content, svc) = Make();
            await svc.SaveAsync(new() { new SupportTemplate("x", "t", "gizli metin") });
            var res = await new ContentController(content).Get(SupportTemplateService.ContentKey);
            Assert.IsType<NotFoundObjectResult>(res);
        }
    }
}
