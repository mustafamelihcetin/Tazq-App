using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using System.Text.Json.Serialization;
using DotNetEnv;
using Tazq_App.Data;
using Tazq_App.Services;
using Tazq_App.Models;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Configuration;

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

var app = builder.Build();

// Set the correct listening URL for Azure
app.Urls.Add("http://+:80");

// Swagger configuration for all environments
app.UseSwagger();
app.UseSwaggerUI();

// Enable CORS
app.UseCors("AllowAllOrigins");

app.UseAuthentication();
app.UseAuthorization();

app.UseHttpsRedirection();
app.MapControllers();
app.Run();
