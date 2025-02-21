using System;
using System.Collections.Concurrent;

namespace Tazq_App.Services
{
	public class OtpService : IOtpService
	{
		private readonly ConcurrentDictionary<string, string> _otpStorage = new();

		public string GenerateOtp()
		{
			var otp = new Random().Next(100000, 999999).ToString();
			return otp;
		}

		public bool ValidateOtp(string phoneNumber, string otp)
		{
			if (_otpStorage.TryGetValue(phoneNumber, out var storedOtp))
			{
				return storedOtp == otp;
			}
			return false;
		}
	}
}
