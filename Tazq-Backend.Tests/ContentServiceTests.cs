using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    public class ContentServiceTests
    {
        private readonly AppDbContext _context;
        private readonly ContentService _service;

        public ContentServiceTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new AppDbContext(options);
            _service = new ContentService(_context);
        }

        [Fact]
        public async Task GetAsync_ShouldReturnNull_WhenKeyMissing()
        {
            Assert.Null(await _service.GetAsync("yok"));
        }

        [Fact]
        public async Task UpsertAsync_ShouldCreate_WhenKeyMissing()
        {
            var doc = await _service.UpsertAsync("curriculum", "{\"a\":1}", null);

            Assert.Equal("curriculum", doc.Key);
            Assert.Equal(1, doc.Version); // İlk sürüm 1'den başlar.
            Assert.NotNull(await _service.GetAsync("curriculum"));
        }

        [Fact]
        public async Task UpsertAsync_ShouldBumpVersion_WhenVersionOmitted()
        {
            await _service.UpsertAsync("curriculum", "{\"a\":1}", null);
            var updated = await _service.UpsertAsync("curriculum", "{\"a\":2}", null);

            // Sürüm otomatik artmalı — istemci senkronu buna dayanıyor.
            Assert.Equal(2, updated.Version);
            Assert.Equal("{\"a\":2}", updated.Json);
        }

        [Fact]
        public async Task UpsertAsync_ShouldRespectExplicitVersion()
        {
            await _service.UpsertAsync("curriculum", "{}", null);
            var pinned = await _service.UpsertAsync("curriculum", "{}", 42);

            Assert.Equal(42, pinned.Version);
        }

        [Fact]
        public async Task UpsertAsync_ShouldNotCreateDuplicateRows()
        {
            await _service.UpsertAsync("curriculum", "{}", null);
            await _service.UpsertAsync("curriculum", "{}", null);

            Assert.Equal(1, await _context.ContentDocuments.CountAsync(c => c.Key == "curriculum"));
        }
    }
}
