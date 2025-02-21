namespace Tazq_App.Services
{
	public interface IOtpService
	{
		string GenerateOtp();
		bool ValidateOtp(string phoneNumber, string otp);
	}
}