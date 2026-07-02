using Google.Apis.Auth;

namespace Tazq_App.Services
{
	public class GoogleTokenValidator : IGoogleTokenValidator
	{
		public async Task<GoogleJsonWebSignature.Payload?> ValidateAsync(string idToken)
		{
			return await GoogleJsonWebSignature.ValidateAsync(idToken);
		}
	}
}
