namespace Tazq_App.Services
{
    /// <summary>
    /// App Store Connect ve Google Play mağaza metrikleri (indirme, puan) için altyapı.
    /// Kimlik bilgileri appsettings / ortam değişkenlerinden okunur; yoksa kanal
    /// "not_configured" döner. Gerçek API çağrıları, mağazada yayın yapılıp kimlik
    /// bilgileri verildiğinde bu sınıfa eklenecek — şimdilik sayılar null.
    /// </summary>
    public interface IStoreMetricsService
    {
        StoreChannelStatus AppStore();
        StoreChannelStatus PlayStore();
    }

    public class StoreMetricsService : IStoreMetricsService
    {
        private readonly IConfiguration _config;

        public StoreMetricsService(IConfiguration config)
        {
            _config = config;
        }

        public StoreChannelStatus AppStore() => Channel("StoreMetrics:AppStore",
            "IssuerId", "KeyId", "PrivateKeyPath", "AppId");

        public StoreChannelStatus PlayStore() => Channel("StoreMetrics:PlayStore",
            "PackageName", "ServiceAccountJsonPath");

        private StoreChannelStatus Channel(string section, params string[] requiredKeys)
        {
            var complete = requiredKeys.All(k => !string.IsNullOrWhiteSpace(_config[$"{section}:{k}"]));
            return new StoreChannelStatus(
                complete ? "pending_api" : "not_configured",
                Downloads: null,
                Rating: null,
                RatingCount: null);
        }
    }
}
