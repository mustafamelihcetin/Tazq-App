namespace Tazq_Frontend.Services
{
	public static class ApiConstants
	{
		public static string BaseUrl =>
			DeviceInfo.Platform == DevicePlatform.Android
				? "https://10.0.2.2:5063/api" // Correct port for Android emulator
				: "https://localhost:5063/api"; // Windows & iOS
	}
}
