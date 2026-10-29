using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Tazq_App.Services
{
    public sealed record FxRates(string Date, string Base, Dictionary<string, decimal> Rates);

    /// <summary>
    /// Günlük döviz kurları — çok birimli ödemelerin YAKLAŞIK toplamı için (madde 12).
    ///
    /// Kaynak: frankfurter (Avrupa Merkez Bankası referans kurları; anahtarsız, ücretsiz).
    /// ECB kurları günde bir kez yayınlanır; 12 saatlik önbellek hem yükü hem dış bağımlılığı
    /// sınırlar. Taban EUR — çapraz kur istemcide (tutar / kur[A] × kur[B]).
    ///
    /// DÜRÜSTLÜK: kur alınamazsa null döner, uç 503 verir ve uygulama "≈ toplam" satırını
    /// gizler. Sabit/eski bir kurla sessizce hesaplamak yanlış bir rakamı doğru gibi
    /// göstermek olurdu. Son başarılı kur 7 gün yedek olarak tutulur.
    /// </summary>
    public class FxRateService
    {
        private const string Url = "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=TRY,USD,GBP";
        private const string FreshKey = "fx:fresh";
        private const string LastGoodKey = "fx:last";
        private readonly HttpClient _http;
        private readonly IMemoryCache _cache;

        public FxRateService(HttpClient http, IMemoryCache cache)
        {
            _http = http;
            _cache = cache;
            _http.Timeout = TimeSpan.FromSeconds(8);
        }

        public async Task<FxRates?> GetRatesAsync()
        {
            if (_cache.TryGetValue(FreshKey, out FxRates? fresh) && fresh != null) return fresh;
            try
            {
                using var res = await _http.GetAsync(Url);
                if (res.IsSuccessStatusCode)
                {
                    using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
                    var rates = new Dictionary<string, decimal> { ["EUR"] = 1m };
                    foreach (var p in doc.RootElement.GetProperty("rates").EnumerateObject())
                        rates[p.Name] = p.Value.GetDecimal();
                    var fx = new FxRates(doc.RootElement.GetProperty("date").GetString() ?? "", "EUR", rates);
                    _cache.Set(FreshKey, fx, TimeSpan.FromHours(12));
                    _cache.Set(LastGoodKey, fx, TimeSpan.FromDays(7));
                    return fx;
                }
            }
            catch (Exception) { /* ağ/zaman aşımı/biçim — aşağıda yedeğe düşülür */ }
            return _cache.TryGetValue(LastGoodKey, out FxRates? last) ? last : null;
        }
    }
}
