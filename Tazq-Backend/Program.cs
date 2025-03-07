﻿using DotNetEnv;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Net;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json.Serialization;
using System.Text;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

// Ignore SSL Certificate Errors in Development
ServicePointManager.ServerCertificateValidationCallback += (sender, certificate, chain, sslPolicyErrors) => true;

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
		policy =>
		{
			policy.AllowAnyOrigin()
				  .AllowAnyMethod()
				  .AllowAnyHeader();
		});
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

builder.Services.AddDbContext<AppDbContext>(options =>
	options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

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
builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("SmtpSettings"));
builder.Services.AddSingleton<ICustomEmailService, CustomEmailService>();

builder.Services.AddHostedService<ScheduledEmailService>();

var certPath = builder.Configuration["Kestrel:Endpoints:Https:Certificate:Path"];
var certPassword = builder.Configuration["Kestrel:Endpoints:Https:Certificate:Password"];

if (!File.Exists(certPath))
{
	Console.WriteLine($"[ERROR] Certificate file not found: {certPath}");
	throw new Exception("HTTPS certificate is missing. Ensure it is correctly set up.");
}
else
{
	var certificate = new X509Certificate2(certPath, certPassword);
	builder.WebHost.ConfigureKestrel(serverOptions =>
	{
		serverOptions.ListenAnyIP(5063, listenOptions =>
		{
			listenOptions.UseHttps(certificate);
		});
	});
}

var app = builder.Build();

// Explicitly tell Swashbuckle which assembly to use
var assembly = typeof(Program).Assembly;

// If running from CLI (Swagger CLI)
if (args.Contains("swagger"))
{
	Console.WriteLine("[INFO] Running in Swagger CLI mode...");
	return;
}

if (app.Environment.IsDevelopment())
{
	app.UseSwagger();
	app.UseSwaggerUI(c =>
	{
		c.SwaggerEndpoint("/swagger/v1/swagger.json", "Tazq API v1");
		c.RoutePrefix = "swagger";
	});
}

// Enable CORS
app.UseCors("AllowAllOrigins");

// Enable Authentication & Authorization
app.UseAuthentication();
app.UseAuthorization();

// Map Controllers
app.MapControllers();

// Run the app
app.Run();

// Required for Swashbuckle CLI tools
public partial class Program { }
