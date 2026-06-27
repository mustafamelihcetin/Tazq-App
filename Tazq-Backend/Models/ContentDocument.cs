using System.ComponentModel.DataAnnotations;

namespace Tazq_App.Models
{
    /// <summary>
    /// Uzaktan güncellenebilir içerik belgesi (ör. "curriculum" müfredat manifesti).
    /// Admin panelden düzenlenir; istemciler sürüm yeniyse yerel baseline'ı override eder.
    /// İçerik koddan ayrıştırılır → müfredat/sınav değişince uygulama güncellemesi gerekmez.
    /// </summary>
    public class ContentDocument
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Belge anahtarı (benzersiz), ör. "curriculum".</summary>
        [Required]
        [MaxLength(64)]
        public string Key { get; set; } = string.Empty;

        /// <summary>Ham JSON içerik (manifest).</summary>
        public string Json { get; set; } = "{}";

        /// <summary>Sürüm — istemci override kararı bununla verilir.</summary>
        public int Version { get; set; } = 1;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
