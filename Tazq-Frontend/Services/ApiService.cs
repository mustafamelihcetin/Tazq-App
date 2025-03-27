using System.Net.Http.Headers;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Maui.Storage;
using Tazq_Frontend.Models;


namespace Tazq_Frontend.Services
{
	public class ApiService
	{
		private readonly HttpClient _httpClient;

		public ApiService()
		{
			_httpClient = new HttpClient
			{
				BaseAddress = new Uri(ApiConstants.BaseUrl)
			};
		}

		// Store JWT Token
		public async Task SaveToken(string? token)
		{
			if (!string.IsNullOrEmpty(token))
			{
				await SecureStorage.SetAsync("jwt_token", token);
			}
		}

		// Get JWT Token
		public async Task<string?> GetToken()
		{
			return await SecureStorage.GetAsync("jwt_token");
		}

		// Set Authorization Header
		private async Task SetAuthHeader()
		{
			var token = await GetToken();
			if (!string.IsNullOrEmpty(token))
			{
				_httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
			}
		}

		// User Register
		public async Task<bool> Register(string email, string name, string password)
		{
			Console.WriteLine("Register fonksiyonu başlatıldı.");

			var request = new { email, name, password };
			var content = new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json");

			try
			{
				HttpResponseMessage response = await _httpClient.PostAsync("users/register", content);

				Console.WriteLine($"Register API Request: users/register");
				Console.WriteLine($"Request Body: {JsonSerializer.Serialize(request)}");
				Console.WriteLine($"Response Status: {response.StatusCode}");
				Console.WriteLine($"Response Content: {await response.Content.ReadAsStringAsync()}");

				return response.IsSuccessStatusCode;
			}
			catch (Exception ex)
			{
				Console.WriteLine($"HATA - Register: {ex.Message}");
				return false;
			}
		}

		// User Login
		public async Task<bool> Login(string email, string password)
		{
			var request = new { email, password };
			var content = new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json");

			try
			{
				Console.WriteLine($"API'ye giriş isteği gönderiliyor: {ApiConstants.BaseUrl}users/login");
				Console.WriteLine($"Request Body: {JsonSerializer.Serialize(request)}");

				HttpResponseMessage response = await _httpClient.PostAsync("users/login", content);
				string responseData = await response.Content.ReadAsStringAsync();

				Console.WriteLine($"Response Status: {response.StatusCode}");
				Console.WriteLine($"Response Content: {responseData}");

				if (!response.IsSuccessStatusCode)
				{
					Console.WriteLine("HATA - API Login başarısız!");
					return false;
				}

				var json = JsonDocument.Parse(responseData);

				if (!json.RootElement.TryGetProperty("token", out var tokenElement) || tokenElement.GetString() == null)
				{
					Console.WriteLine("HATA - API token göndermedi veya boş döndü.");
					return false;
				}

				var token = tokenElement.GetString();
				await SaveToken(token);

				Console.WriteLine("Login başarılı, token kaydedildi.");
				return true;
			}
			catch (Exception ex)
			{
				Console.WriteLine($"HATA - Login Exception: {ex.Message}");
				return false;
			}
		}

		// Get User Tasks
		public async Task<List<TaskModel>> GetTasks()
		{
			await SetAuthHeader();
			try
			{
				HttpResponseMessage response = await _httpClient.GetAsync("tasks");

				Console.WriteLine($"GetTasks API Request: tasks");
				Console.WriteLine($"Response Status: {response.StatusCode}");
				Console.WriteLine($"Response Content: {await response.Content.ReadAsStringAsync()}");

				if (!response.IsSuccessStatusCode)
				{
					Console.WriteLine("HATA - GetTasks başarısız.");
					return new List<TaskModel>();
				}

				var json = await response.Content.ReadAsStringAsync();
				return JsonSerializer.Deserialize<List<TaskModel>>(json) ?? new List<TaskModel>();
			}
			catch (Exception ex)
			{
				Console.WriteLine($"HATA - GetTasks: {ex.Message}");
				return new List<TaskModel>();
			}
		}

		// Add New Task
		public async Task<bool> AddTask(TaskModel task)
		{
			await SetAuthHeader();

			var options = new JsonSerializerOptions
			{
				PropertyNamingPolicy = null,
				DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
				Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
				Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
			};

			var payload = new
			{
				title = task.Title,
				description = task.Description,
				dueDate = task.DueDate,
				isCompleted = task.IsCompleted,
				priority = task.Priority,
				tags = task.Tags
			};

			var json = JsonSerializer.Serialize(payload, options);
			var content = new StringContent(json, Encoding.UTF8, "application/json");

			try
			{
				var response = await _httpClient.PostAsync("tasks", content);
				var responseContent = await response.Content.ReadAsStringAsync();

				Console.WriteLine($"[DOTNET] AddTask API Request: tasks");
				Console.WriteLine($"[DOTNET] Request Body: {json}");
				Console.WriteLine($"[DOTNET] Response Status: {response.StatusCode}");
				Console.WriteLine($"[DOTNET] Response Content: {responseContent}");

				return response.IsSuccessStatusCode;
			}
			catch (Exception ex)
			{
				Console.WriteLine($"HATA - AddTask: {ex.Message}");
				return false;
			}
		}


		// User Register with response message
		public async Task<(bool IsSuccess, string? ErrorMessage)> RegisterWithMessage(string email, string name, string password)
		{
			Console.WriteLine("RegisterWithMessage fonksiyonu başlatıldı.");

			var request = new { email, name, password };
			var content = new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json");

			try
			{
				HttpResponseMessage response = await _httpClient.PostAsync("users/register", content);

				Console.WriteLine($"Register API Request: users/register");
				Console.WriteLine($"Request Body: {JsonSerializer.Serialize(request)}");
				Console.WriteLine($"Response Status: {response.StatusCode}");
				string responseContent = await response.Content.ReadAsStringAsync();
				Console.WriteLine($"Response Content: {responseContent}");

				if (response.IsSuccessStatusCode)
				{
					return (true, null);
				}
				else
				{
					return (false, responseContent);
				}
			}
			catch (Exception ex)
			{
				Console.WriteLine($"HATA - RegisterWithMessage: {ex.Message}");
				return (false, "Sunucu hatası oluştu.");
			}
		}
	}
}