using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    // İçerik belgelerinin veri erişimi. Controller'ın DbContext'e doğrudan
    // dokunmaması için ayrıldı: HTTP katmanı ne EF'i ne de sürüm artırma
    // kuralını bilmek zorunda.
    public class ContentService : IContentService
    {
        private readonly AppDbContext _context;

        public ContentService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<ContentDocument?> GetAsync(string key)
            => await _context.ContentDocuments.AsNoTracking().FirstOrDefaultAsync(c => c.Key == key);

        public async Task<ContentDocument> UpsertAsync(string key, string json, int? version)
        {
            var doc = await _context.ContentDocuments.FirstOrDefaultAsync(c => c.Key == key);
            if (doc == null)
            {
                doc = new ContentDocument
                {
                    Key = key,
                    Json = json,
                    Version = version ?? 1,
                    UpdatedAt = DateTime.UtcNow,
                };
                _context.ContentDocuments.Add(doc);
            }
            else
            {
                doc.Json = json;
                // Sürüm açıkça verilmediyse otomatik artır — istemciler bununla senkron olur.
                doc.Version = version ?? (doc.Version + 1);
                doc.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return doc;
        }
    }
}
