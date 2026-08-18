using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Logging;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Tazq_App.Services
{
	public class AppleTokenValidator : IAppleTokenValidator
	{
		private readonly ILogger<AppleTokenValidator> _logger;
		private readonly IHttpClientFactory _httpFactory;

		/*
		  APPLE ANAHTAR SUNUCUSUNA ÇAĞRI — iki ayrı sorun vardı.

		  1) ZAMAN AŞIMI YOKTU. `new HttpClient()` 100 saniyelik varsayılanla gelir.
		     Apple'ın anahtar ucu yavaşlarsa her Apple girişi 100 saniye boyunca bir
		     istek işleyicisini tutar. Giriş, kullanıcının BEKLEDİĞİ bir akış; 100 sn
		     beklemek pratikte "uygulama donuk" demek. 10 sn fazlasıyla yeterli:
		     sağlıklı yanıt milisaniyeler sürüyor ve başarısızlıkta akış zaten
		     null dönüp temiz bir hata veriyor.

		  2) HER ÇAĞRIDA YENİ HttpClient. Klasik soket tükenmesi deseni: her HttpClient
		     kendi bağlantı havuzunu açar ve `Dispose` sonrası soket TIME_WAIT'te
		     bekler. Yoğun girişte kullanılabilir port biter. IHttpClientFactory
		     bağlantı havuzunu paylaştırır — bu sınıf zaten Singleton, fabrika da öyle.
		*/
		private static readonly TimeSpan AppleKeysTimeout = TimeSpan.FromSeconds(10);

		public AppleTokenValidator(ILogger<AppleTokenValidator> logger, IHttpClientFactory httpFactory)
		{
			_logger = logger;
			_httpFactory = httpFactory;
		}

		public async Task<ClaimsPrincipal?> ValidateAsync(string identityToken)
		{
			try
			{
				var handler = new JwtSecurityTokenHandler();
				if (!handler.CanReadToken(identityToken))
				{
					return null;
				}

				var httpClient = _httpFactory.CreateClient();
				httpClient.Timeout = AppleKeysTimeout;
				var keysJson = await httpClient.GetStringAsync("https://appleid.apple.com/auth/keys");
				var keySet = new JsonWebKeySet(keysJson);

				var validationParameters = new TokenValidationParameters
				{
					ValidateIssuer = true,
					ValidIssuer = "https://appleid.apple.com",
					ValidateAudience = true,
					ValidAudiences = new[] { "com.tazqapp.tazq", "com.tazqapp.tazq.dev" },
					ValidateLifetime = true,
					IssuerSigningKeys = keySet.Keys,
					ClockSkew = TimeSpan.FromMinutes(5)
				};

				return handler.ValidateToken(identityToken, validationParameters, out _);
			}
			catch (Exception ex)
			{
				_logger.LogError(ex, "Apple token validation failed in validator.");
				return null;
			}
		}
	}
}
