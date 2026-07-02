using Google.Apis.Auth;

namespace Tazq_App.Services
{
	public interface IGoogleTokenValidator
	{
		Task<GoogleJsonWebSignature.Payload?> ValidateAsync(string idToken);
	}
}
