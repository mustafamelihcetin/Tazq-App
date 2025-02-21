namespace Tazq_App.Services
{
	public interface ICustomSmsService
	{
		Task<bool> SendSmsAsync(string phoneNumber, string message);
	}
}
