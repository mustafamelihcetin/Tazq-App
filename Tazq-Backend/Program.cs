using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using DotNetEnv;
using Tazq_App.Data;
using Tazq_App.Services;
using Tazq_App.Models;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Diagnostics;
using Npgsql.EntityFrameworkCore.PostgreSQL;

var builder = WebApplication.CreateBuilder(args);

// Load environment variables from .env file
Env.Load();

// Load JWT settings
var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY")
			 ?? throw new Exception("JWT_KEY is missing! Set it in environment variables.");
var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? builder.Configuration["JwtSettings:Issuer"];
var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? builder.Configuration["JwtSettings:Audience"];
var jwtExpiration = Convert.ToInt32(Environment.GetEnvironmentVariable("JWT_EXPIRATION") ?? builder.Configuration["JwtSettings:ExpirationInMinutes"] ?? "60");

// Validate JWT Key
if (string.IsNullOrEmpty(jwtKey) || jwtKey.Length < 32)
{
	throw new Exception("JWT_KEY is missing or too short! It must be at least 32 characters long.");
}

builder.Services.AddControllers()
	.AddJsonOptions(options =>
	{
		options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
		options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
		options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
	});

builder.Services.AddEndpointsApiExplorer();

// CORS Configuration
builder.Services.AddCors(options =>
{
	options.AddPolicy("AllowAllOrigins",
		builder => builder.AllowAnyOrigin()
			.AllowAnyMethod()
			.AllowAnyHeader());
});

// Swagger JWT Authentication Integration
builder.Services.AddSwaggerGen(options =>
{
	options.SwaggerDoc("v1", new OpenApiInfo { Title = "Tazq-App API", Version = "v1" });

	options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
	{
		Name = "Authorization",
		Type = SecuritySchemeType.Http,
		Scheme = "Bearer",
		BearerFormat = "JWT",
		In = ParameterLocation.Header,
		Description = "Enter 'Bearer' followed by your valid token."
	});

	options.AddSecurityRequirement(new OpenApiSecurityRequirement
	{
		{
			new OpenApiSecurityScheme
			{
				Reference = new OpenApiReference
				{
					Type = ReferenceType.SecurityScheme,
					Id = "Bearer"
				}
			},
			new string[] {}
		}
	});
});

// PostgreSQL connection string from environment
var pgHost = Environment.GetEnvironmentVariable("DB_HOST");
var pgPort = Environment.GetEnvironmentVariable("DB_PORT");
var pgDb = Environment.GetEnvironmentVariable("DB_NAME");
var pgUser = Environment.GetEnvironmentVariable("DB_USER");
var pgPassword = Environment.GetEnvironmentVariable("DB_PASSWORD");


if (string.IsNullOrWhiteSpace(pgHost) || string.IsNullOrWhiteSpace(pgDb))
	throw new Exception("PostgreSQL environment variables are missing!");

var pgConnectionString = $"Host={pgHost};Port={pgPort};Database={pgDb};Username={pgUser};Password={pgPassword}";

builder.Services.AddDbContext<AppDbContext>(options =>
	options.UseNpgsql(pgConnectionString));

// JWT Authentication
var keyBytes = Encoding.UTF8.GetBytes(jwtKey);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
	.AddJwtBearer(options =>
	{
		options.TokenValidationParameters = new TokenValidationParameters
		{
			ValidateIssuer = true,
			ValidateAudience = true,
			ValidateLifetime = true,
			ValidateIssuerSigningKey = true,
			ValidIssuer = jwtIssuer,
			ValidAudience = jwtAudience,
			IssuerSigningKey = new SymmetricSecurityKey(keyBytes)
		};
	});

// Register Services
builder.Services.AddSingleton<JwtService>();
builder.Services.Configure<SmtpSettings>(options =>
{
	options.FromEmail = Environment.GetEnvironmentVariable("SMTP_FROM_EMAIL");
	options.Username = Environment.GetEnvironmentVariable("SMTP_USERNAME");
	options.Password = Environment.GetEnvironmentVariable("SMTP_PASSWORD");
	options.Port = int.Parse(Environment.GetEnvironmentVariable("SMTP_PORT") ?? "587");
	options.Server = Environment.GetEnvironmentVariable("SMTP_SERVER");
});
builder.Services.AddSingleton<ICustomEmailService, CustomEmailService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
	app.UseDeveloperExceptionPage();
}

using (var scope = app.Services.CreateScope())
{
	var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
	db.Database.EnsureCreated(); // Creates a table if it doesn't exist
}

// Set dynamic port for Azure
var port = Environment.GetEnvironmentVariable("PORT") ?? "8181";
app.Urls.Add($"http://+:{port}");

app.UseSwagger();
app.UseSwaggerUI();

app.UseExceptionHandler(errorApp =>
{
	errorApp.Run(async context =>
	{
		context.Response.StatusCode = 500;
		context.Response.ContentType = "application/json";

		var error = context.Features.Get<IExceptionHandlerFeature>();
		if (error != null)
		{
			var ex = error.Error;

			var result = JsonSerializer.Serialize(new
			{
				StatusCode = 500,
				Message = ex.Message,
				StackTrace = ex.StackTrace
			});

			await context.Response.WriteAsync(result);
		}
	});
});

app.UseCors("AllowAllOrigins");
app.UseAuthentication();
app.UseAuthorization();
app.UseHttpsRedirection();
app.MapControllers();
app.Run();
