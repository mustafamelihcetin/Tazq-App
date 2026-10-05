using System.ComponentModel.DataAnnotations;

namespace Tazq_App.Models
{
    /// <summary>
    /// Kayıt olmadan (misafir) kullanılan cihazların anonim sayımı. Kimlik istemcide
    /// rastgele üretilen bir UUID — kişisel veri YOK. Kayıtlı kullanıcıların cihazları da
    /// burada görünebilir; iki sayı üst üste binebilir, toplam "kayıtsız" değil "cihaz".
    /// </summary>
    public class AppInstall
    {
        [Key]
        public Guid InstallId { get; set; }
        public string Platform { get; set; } = string.Empty;
        public DateTime FirstSeenAt { get; set; } = DateTime.UtcNow;
        public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
    }
}
