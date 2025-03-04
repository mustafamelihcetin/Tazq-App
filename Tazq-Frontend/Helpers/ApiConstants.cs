namespace Tazq_Frontend.Services
{
	public static class ApiConstants
	{
		public static string BaseUrl =>
			DeviceInfo.Platform == DevicePlatform.Android
				? "http://10.0.2.2:5062/api" // Android
				: "http://localhost:5062/api"; // Windows & iOS
	}
}
