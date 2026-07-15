using Tazq_App.Models;

namespace Tazq_App.Services
{
    public interface IContentService
    {
        Task<ContentDocument?> GetAsync(string key);

        /// <summary>Belgeyi oluşturur ya da günceller. Sürüm verilmezse otomatik +1.</summary>
        Task<ContentDocument> UpsertAsync(string key, string json, int? version);
    }
}
