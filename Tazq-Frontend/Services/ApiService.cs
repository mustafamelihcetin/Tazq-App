using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Maui.Storage;
using Tazq_Frontend.Models;
using Tazq_Frontend.Services;

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

		// Register User
		public async Task<bool> Register(string fullName, string email, string password)
		{
			var request = new { FullName = fullName, Email = email, Password = password };
			var content = new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json");

			try
			{
				Console.WriteLine($"Register request: {JsonSerializer.Serialize(request)}");

				HttpResponseMessage response = await _httpClient.PostAsync($"{ApiConstants.BaseUrl}/users/register", content);
				string responseData = await response.Content.ReadAsStringAsync();

				Console.WriteLine($"Register Response Status: {response.StatusCode}");
				Console.WriteLine($"Register Response Content: {responseData}");

				return response.IsSuccessStatusCode;
			}
			catch (Exception ex)
			{
				Console.WriteLine($"ERROR - Register: {ex.Message}");
				return false;
			}
		}

		// User Login
		public async Task<bool> Login(string email, string password)
		{
			var request = new { email, password };
			var content = new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json");

			Console.WriteLine($"Login request being sent to: {ApiConstants.BaseUrl}/users/login");
			Console.WriteLine($"Request Body: {JsonSerializer.Serialize(request)}");

			try
			{
				HttpResponseMessage response = await _httpClient.PostAsync($"{ApiConstants.BaseUrl}/users/login", content);
				string responseData = await response.Content.ReadAsStringAsync();

				Console.WriteLine($"Login Response Status: {response.StatusCode}");
				Console.WriteLine($"Login Response Content: {responseData}");

				return response.IsSuccessStatusCode;
			}
			catch (Exception ex)
			{
				Console.WriteLine($"ERROR - Login: {ex.Message}");
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
	}
}
