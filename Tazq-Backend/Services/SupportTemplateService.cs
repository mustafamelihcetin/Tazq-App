using System.Text.Json;

namespace Tazq_App.Services
{
    /// <summary>
    /// Destek hazır yanıt şablonları (madde 9, 2026-10-30). Ayrı tablo yerine içerik deposunda
    /// İÇ anahtarla saklanır (migrasyon yok); ContentController "internal-" önekli anahtarları
    /// herkese açık GET'te asla döndürmez. Hiç kaydedilmediyse varsayılan set döner.
    /// Gövdede {ad} yer tutucusu istemcide kullanıcının ilk adıyla doldurulur.
    /// </summary>
    public class SupportTemplateService : ISupportTemplateService
    {
        public const string ContentKey = "internal-support-templates";
        public const int MaxTemplates = 30, MaxTitle = 40, MaxBody = 1000;
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        private readonly IContentService _content;
        public SupportTemplateService(IContentService content) => _content = content;

        public static readonly IReadOnlyList<SupportTemplate> Defaults = new List<SupportTemplate>
        {
            new("thanks", "Teşekkür · inceleniyor", "Merhaba {ad}, bize yazdığın için teşekkürler. Konuyu inceliyoruz, en kısa sürede dönüş yapacağız."),
            new("more-info", "Daha fazla bilgi", "Merhaba {ad}, sorunu daha iyi anlamak için hangi cihazı ve uygulama sürümünü kullandığını, sorunun hangi adımda ortaya çıktığını yazabilir misin? Ekran görüntüsü de çok yardımcı olur."),
            new("fixed", "Düzeltildi", "Merhaba {ad}, bildirdiğin sorun yeni sürümde düzeltildi. Uygulamayı güncellemeni rica ederiz; sorun sürerse buradan yazman yeterli."),
            new("sync", "Eşitleme", "Merhaba {ad}, uygulamayı tamamen kapatıp yeniden açmayı ve internet bağlantını kontrol etmeyi dener misin? Verilerin hesabında güvende; bağlantı gelince eşitlenir."),
            new("idea", "Öneri için teşekkür", "Merhaba {ad}, önerin için çok teşekkürler! Not aldık ve yol haritamızı değerlendirirken dikkate alacağız."),
            new("account", "Hesap ve veri", "Merhaba {ad}, verilerini Ayarlar → Hesap & Destek → Verilerimi indir bölümünden indirebilir, hesabını da aynı yerden silebilirsin."),
        };

        public async Task<List<SupportTemplate>> GetAsync()
        {
            var doc = await _content.GetAsync(ContentKey);
            if (doc == null) return Defaults.ToList();
            try { return JsonSerializer.Deserialize<List<SupportTemplate>>(doc.Json, Json) ?? Defaults.ToList(); }
            catch (JsonException) { return Defaults.ToList(); }
        }

        /// <summary>Doğrular, temizler ve kaydeder. Geçersizse null (hata metniyle).</summary>
        public async Task<(List<SupportTemplate>? Saved, string? Error)> SaveAsync(List<SupportTemplate>? items)
        {
            if (items == null) return (null, "Liste boş olamaz.");
            if (items.Count > MaxTemplates) return (null, $"En çok {MaxTemplates} şablon olabilir.");
            var clean = new List<SupportTemplate>();
            foreach (var t in items)
            {
                var title = (t.Title ?? "").Trim();
                var body = (t.Body ?? "").Trim();
                if (title.Length == 0 || body.Length == 0) return (null, "Başlık ve metin boş olamaz.");
                if (title.Length > MaxTitle || body.Length > MaxBody) return (null, $"Başlık en çok {MaxTitle}, metin en çok {MaxBody} karakter.");
                var id = string.IsNullOrWhiteSpace(t.Id) ? Guid.NewGuid().ToString("N")[..8] : t.Id.Trim();
                clean.Add(new SupportTemplate(id, title, body));
            }
            await _content.UpsertAsync(ContentKey, JsonSerializer.Serialize(clean, Json), null);
            return (clean, null);
        }
    }

    public record SupportTemplate(string Id, string Title, string Body);

    public interface ISupportTemplateService
    {
        Task<List<SupportTemplate>> GetAsync();
        Task<(List<SupportTemplate>? Saved, string? Error)> SaveAsync(List<SupportTemplate>? items);
    }
}
