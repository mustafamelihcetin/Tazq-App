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
            _httpClient.DefaultRequestHeaders.Add("X-App-Signature", "tazq-maui-frontend");
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

				// JSON camelCase'e duyarsız deserialize
				var options = new JsonSerializerOptions
				{
					PropertyNameCaseInsensitive = true
				};

				return JsonSerializer.Deserialize<List<TaskModel>>(json, options) ?? new List<TaskModel>();
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
                dueTime = task.DueTime,
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

		// Reset password API call
		public async Task<HttpResponseMessage> ResetPasswordAsync(object resetRequest)
		{
			var content = new StringContent(
				JsonSerializer.Serialize(resetRequest),
				Encoding.UTF8,
				"application/json"
			);

			return await _httpClient.PostAsync("users/reset-password", content);
		}

		// General purpose POST method for custom payloads
		public async Task<HttpResponseMessage> PostAsync(string endpoint, object data)
		{
			var json = JsonSerializer.Serialize(data);
			var content = new StringContent(json, Encoding.UTF8, "application/json");
			await SetAuthHeader();
			return await _httpClient.PostAsync(endpoint, content);
		}

		public async Task<HttpResponseMessage> SendForgotPasswordEmail(string email)
		{
			var request = new { Email = email };
			return await PostAsync("users/forgot-password", request);
		}
        public async Task<bool> DeleteTask(int taskId)
        {
            await SetAuthHeader();
            try
            {
                var response = await _httpClient.DeleteAsync($"tasks/{taskId}");
                Console.WriteLine($"[DOTNET] DeleteTask API Request: tasks/{taskId}");
                Console.WriteLine($"[DOTNET] Response Status: {response.StatusCode}");
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"HATA - DeleteTask: {ex.Message}");
                return false;
            }
        }

        public async Task<bool> UpdateTask(TaskModel task)
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
                dueTime = task.DueTime,
                isCompleted = task.IsCompleted,
                priority = task.Priority,
                tags = task.Tags
            };

            var json = JsonSerializer.Serialize(payload, options);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            try
            {
                var response = await _httpClient.PutAsync($"tasks/{task.Id}", content);
                var responseContent = await response.Content.ReadAsStringAsync();

                Console.WriteLine($"[DOTNET] UpdateTask API Request: tasks/{task.Id}");
                Console.WriteLine($"[DOTNET] Request Body: {json}");
                Console.WriteLine($"[DOTNET] Response Status: {response.StatusCode}");
                Console.WriteLine($"[DOTNET] Response Content: {responseContent}");

                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"HATA - UpdateTask: {ex.Message}");
                return false;
            }
        }

        public async Task<TaskModel?> GetTaskById(int id)
        {
            await SetAuthHeader();
            try
            {
                HttpResponseMessage response = await _httpClient.GetAsync($"tasks/{id}");
                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine("HATA - GetTaskById başarısız.");
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync();

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                var task = JsonSerializer.Deserialize<TaskModel>(json, options);
                return task;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"HATA - GetTaskById: {ex.Message}");
                return null;
            }
        }

        public async Task<bool> CheckTokenValidityAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/api/auth/check");
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        public async Task<string?> RefreshTokenAsync()
        {
            var token = await GetToken();
            if (string.IsNullOrEmpty(token))
                return null;

            var request = new HttpRequestMessage(HttpMethod.Post, "users/refresh-session");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            try
            {
                var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                    return null;

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);

                if (doc.RootElement.TryGetProperty("token", out var tokenProp))
                {
                    var newToken = tokenProp.GetString();
                    await SaveToken(newToken);
                    return newToken;
                }

                return null;
            }
            catch
            {
                return null;
            }
        }
    }
}