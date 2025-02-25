using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Maui.Storage;
using Tazq_Frontend.Models;

namespace Tazq_Frontend.Services
{
	public class ApiService
	{
		private readonly HttpClient _httpClient;
		private const string BaseUrl = "https://localhost:7031/api"; // Backend URL

		public ApiService()
		{
			_httpClient = new HttpClient();
		}

		// Store JWT Token
		public async Task SaveToken(string token)
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
			var request = new { email, name, password };
			var content = new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json");

			var response = await _httpClient.PostAsync($"{BaseUrl}/users/register", content);
			return response.IsSuccessStatusCode;
		}

		// User Login
		public async Task<bool> Login(string email, string password)
		{
			var request = new { email, password };
			var content = new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json");

			var response = await _httpClient.PostAsync($"{BaseUrl}/users/login", content);
			if (!response.IsSuccessStatusCode) return false;

			var responseData = await response.Content.ReadAsStringAsync();
			var json = JsonDocument.Parse(responseData);
			var token = json.RootElement.GetProperty("token").GetString();

			if (token != null)
			{
				await SaveToken(token);
				return true;
			}

			return false;
		}

		// Get User Tasks
		public async Task<List<TaskModel>> GetTasks()
		{
			await SetAuthHeader();
			var response = await _httpClient.GetAsync($"{BaseUrl}/tasks");
			if (!response.IsSuccessStatusCode) return new List<TaskModel>();

			var json = await response.Content.ReadAsStringAsync();
			return JsonSerializer.Deserialize<List<TaskModel>>(json) ?? new List<TaskModel>();
		}
	}
}
