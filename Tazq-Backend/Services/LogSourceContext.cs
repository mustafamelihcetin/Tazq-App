namespace Tazq_App.Services
{
    /// <summary>
    /// İşlenmekte olan isteğin KAYNAĞINI, o isteğin tüm çağrı zinciri boyunca taşır.
    ///
    /// NEDEN AsyncLocal: log kayıtları `ILogger` üzerinden, isteğin çok altındaki
    /// servislerden düşüyor. Oralara `HttpContext` geçirmek her servisin imzasını
    /// kirletirdi. `AsyncLocal` değeri `await` sınırları boyunca taşır ve istek bitince
    /// kendiliğinden düşer — tam olarak bu iş için var.
    ///
    /// NEDEN `static` bir alan güvenli: her istek kendi yürütme bağlamında çalışır,
    /// bu yüzden eşzamanlı isteklerin değerleri birbirine karışmaz. Klasik `static`
    /// paylaşımından farkı budur.
    /// </summary>
    public static class LogSourceContext
    {
        private static readonly AsyncLocal<LogSource> _current = new();

        public static LogSource Current
        {
            get => _current.Value;
            set => _current.Value = value;
        }

        /// <summary>
        /// İstemcinin bildirdiği metni kaynağa çevirir.
        ///
        /// Bilinmeyen/boş değer `Unknown` olur, `Production` DEĞİL: bir isteğin
        /// production olduğunu ancak kendisi söylediğinde biliriz. Varsayılanı
        /// production yapmak, etiketsiz her şeyi canlı sanmak demekti.
        /// </summary>
        public static LogSource Parse(string? header) => header?.Trim().ToLowerInvariant() switch
        {
            "dev" or "development" => LogSource.Development,
            "prod" or "production" => LogSource.Production,
            _ => LogSource.Unknown,
        };
    }

    /// <summary>
    /// İstek başlığını okuyup bağlama yazar. Boru hattında ERKEN çalışmalı ki
    /// kimlik doğrulama/imza katmanlarının ürettiği hatalar da etiketlensin —
    /// zaten en çok merak edilen hatalar onlar.
    /// </summary>
    public class LogSourceMiddleware
    {
        /// <summary>İstemcinin kendini bildirdiği başlık (bkz. Tazq-Frontend api istemcisi).</summary>
        public const string HeaderName = "X-App-Variant";

        private readonly RequestDelegate _next;

        public LogSourceMiddleware(RequestDelegate next) => _next = next;

        public async Task InvokeAsync(HttpContext context)
        {
            LogSourceContext.Current = LogSourceContext.Parse(
                context.Request.Headers.TryGetValue(HeaderName, out var v) ? v.ToString() : null);

            await _next(context);
        }
    }
}
