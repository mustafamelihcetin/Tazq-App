namespace Tazq_Frontend.Services
{
	public static class ApiConstants
	{
		// Prod URL: 
		// public static string BaseUrl => "https://tazq-backend.onrender.com/api/";

		// Local / Docker URL:
#if ANDROID
        public static string BaseUrl => "http://10.0.2.2:5200/api/";
#else
        public static string BaseUrl => "http://localhost:5200/api/";
#endif
	}
}
