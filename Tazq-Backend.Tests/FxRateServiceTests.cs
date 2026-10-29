using System.Net;
using Microsoft.Extensions.Caching.Memory;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// Madde 12 — çok birimli ödemelerin YAKLAŞIK toplamı için günlük ECB kurları
    /// (frankfurter). Kur alınamazsa uygulama yaklaşık satırı gizler; uydurma kur yok.
    /// </summary>
    public class FxRateServiceTests
    {
        private sealed class Handler : HttpMessageHandler
        {
            public int Calls;
            public Func<HttpResponseMessage> Respond = () => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"amount\":1.0,\"base\":\"EUR\",\"date\":\"2026-10-29\",\"rates\":{\"GBP\":0.83578,\"TRY\":55.4691,\"USD\":1.113}}"),
            };
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken c)
            {
                Calls++;
                return Task.FromResult(Respond());
            }
        }

        private static (FxRateService svc, Handler h) Make()
        {
            var h = new Handler();
            return (new FxRateService(new HttpClient(h), new MemoryCache(new MemoryCacheOptions())), h);
        }

        [Fact]
        public async Task ParsesRates_WithEurBase()
        {
            var (svc, _) = Make();
            var r = await svc.GetRatesAsync();
            Assert.NotNull(r);
            Assert.Equal("2026-10-29", r!.Date);
            Assert.Equal(1m, r.Rates["EUR"]);
            Assert.Equal(55.4691m, r.Rates["TRY"]);
        }

        [Fact]
        public async Task CachesBetweenCalls()
        {
            var (svc, h) = Make();
            await svc.GetRatesAsync();
            await svc.GetRatesAsync();
            Assert.Equal(1, h.Calls);
        }

        [Fact]
        public async Task ProviderDown_ReturnsNull_NotFakeRates()
        {
            var (svc, h) = Make();
            h.Respond = () => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable);
            Assert.Null(await svc.GetRatesAsync());
        }
    }
}
