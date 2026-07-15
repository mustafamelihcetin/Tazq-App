using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tazq_App.Services;

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
        private readonly IContentService _content;

        public ContentController(IContentService content)
        {
            _content = content;
        }

        // İstemci: belge anahtarına göre güncel içerik + sürüm.
        [HttpGet("{key}")]
        public async Task<IActionResult> Get(string key)
        {
            var doc = await _content.GetAsync(key);
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

            var json = dto.Json ?? "{}";

            // JSON doğrulaması — bozuk içerik istemcileri kırmasın.
            try { using var _ = System.Text.Json.JsonDocument.Parse(json); }
            catch (System.Text.Json.JsonException) { return BadRequest(new { message = "Body is not valid JSON." }); }

            var doc = await _content.UpsertAsync(key, json, dto.Version);
            return Ok(new { key = doc.Key, version = doc.Version, json = doc.Json, updatedAt = doc.UpdatedAt });
        }
    }
}
