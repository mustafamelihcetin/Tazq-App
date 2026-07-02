using System.Security.Claims;

namespace Tazq_App.Services
{
	public interface IAppleTokenValidator
	{
		Task<ClaimsPrincipal?> ValidateAsync(string identityToken);
	}
}
