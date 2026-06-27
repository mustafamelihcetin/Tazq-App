using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Controllers
{
    /// <summary>
    /// Uzaktan güncellenebilir içerik (ör. müfredat manifesti).
    /// GET: tüm oturum açmış kullanıcılar (istemci senkronu).
    /// PUT: yalnız admin (admin panelden düzenleme).
    /// </summary>
    [Route("api/content")]
    [ApiController]
    [Authorize]
    public class ContentController : ControllerBase
    {
        private readonly AppDbContext _db;

        public ContentController(AppDbContext db)
        {
            _db = db;
        }

        // İstemci: belge anahtarına göre güncel içerik + sürüm.
        [HttpGet("{key}")]
        public async Task<IActionResult> Get(string key)
        {
            var doc = await _db.ContentDocuments.AsNoTracking().FirstOrDefaultAsync(c => c.Key == key);
            if (doc == null)
                return NotFound(new { message = "Content not found." });
            return Ok(new { key = doc.Key, version = doc.Version, json = doc.Json, updatedAt = doc.UpdatedAt });
        }

        public class UpsertContentDto
        {
            public string Json { get; set; } = "{}";
            // İsteğe bağlı sürüm; verilmezse otomatik +1.
            public int? Version { get; set; }
        }

        // Admin: içerik oluştur/güncelle. Sürüm verilmezse otomatik artırılır.
        [HttpPut("{key}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Upsert(string key, [FromBody] UpsertContentDto dto)
        {
            if (string.IsNullOrWhiteSpace(key) || key.Length > 64)
                return BadRequest(new { message = "Invalid key." });

            // JSON doğrulaması — bozuk içerik istemcileri kırmasın.
            try { using var _ = System.Text.Json.JsonDocument.Parse(dto.Json ?? "{}"); }
            catch { return BadRequest(new { message = "Body is not valid JSON." }); }

            var doc = await _db.ContentDocuments.FirstOrDefaultAsync(c => c.Key == key);
            if (doc == null)
            {
                doc = new ContentDocument
                {
                    Key = key,
                    Json = dto.Json ?? "{}",
                    Version = dto.Version ?? 1,
                    UpdatedAt = DateTime.UtcNow,
                };
                _db.ContentDocuments.Add(doc);
            }
            else
            {
                doc.Json = dto.Json ?? "{}";
                doc.Version = dto.Version ?? (doc.Version + 1);
                doc.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
            return Ok(new { key = doc.Key, version = doc.Version, json = doc.Json, updatedAt = doc.UpdatedAt });
        }
    }
}
