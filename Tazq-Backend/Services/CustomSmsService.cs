using System;
using System.Threading.Tasks;

namespace Tazq_App.Services
{
	public class CustomSmsService : ICustomSmsService
	{
		public async Task<bool> SendSmsAsync(string phoneNumber, string message)
		{
			Console.WriteLine($"Sending SMS to {phoneNumber}: {message}");
			await Task.Delay(1000); // Simulate SMS sending delay
			return true;
		}
	}
}
