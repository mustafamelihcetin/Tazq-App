using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Logging;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Tazq_App.Services
{
	public class AppleTokenValidator : IAppleTokenValidator
	{
		private readonly ILogger<AppleTokenValidator> _logger;

		public AppleTokenValidator(ILogger<AppleTokenValidator> logger)
		{
			_logger = logger;
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

				using var httpClient = new HttpClient();
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
