namespace Tazq_Frontend.Services
{
	public static class ApiConstants
	{
		public static string BaseUrl =>
			DeviceInfo.Platform == DevicePlatform.Android
				? "http://10.0.2.2:7031/api" // Android
				: "http://localhost:7031/api"; // Windows & iOS
	}
}
