using System.Net;
using System.Text.Json;

public class ErrorHandlingMiddleware
{
	private readonly RequestDelegate _next;

	public ErrorHandlingMiddleware(RequestDelegate next)
	{
		_next = next;
	}

	public async Task Invoke(HttpContext context)
	{
		try
		{
			await _next(context);

			// Handle Unauthorized (401) or Forbidden (403) responses
			if (context.Response.StatusCode == StatusCodes.Status401Unauthorized)
			{
				await HandleCustomResponseAsync(context, StatusCodes.Status401Unauthorized, "Unauthorized access. Please log in.");
			}
			else if (context.Response.StatusCode == StatusCodes.Status403Forbidden)
			{
				await HandleCustomResponseAsync(context, StatusCodes.Status403Forbidden, "You do not have permission to access this resource.");
			}
		}
		catch (Exception ex)
		{
			await HandleExceptionAsync(context, ex);
		}
	}

	private static Task HandleExceptionAsync(HttpContext context, Exception exception)
	{
		var response = new { status = 500, message = exception.Message, error = exception.GetType().Name };
		var jsonResponse = JsonSerializer.Serialize(response);

		context.Response.ContentType = "application/json";
		context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

		return context.Response.WriteAsync(jsonResponse);
	}

	private static Task HandleCustomResponseAsync(HttpContext context, int statusCode, string message)
	{
		var response = new { status = statusCode, message };
		var jsonResponse = JsonSerializer.Serialize(response);

		context.Response.ContentType = "application/json";
		context.Response.StatusCode = statusCode;

		return context.Response.WriteAsync(jsonResponse);
	}
}
