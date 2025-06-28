using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using DotNetEnv;
using Tazq_App.Data;
using Tazq_App.Models;
using Microsoft.AspNetCore.Diagnostics;
using Npgsql.EntityFrameworkCore.PostgreSQL;
using Tazq_App.Services;

var builder = WebApplication.CreateBuilder(args);

// Load environment variables from .env file
Env.Load();

// Load app signature for request validation
var appSignature = Environment.GetEnvironmentVariable("APP_SIGNATURE") ?? "tazq-maui-frontend";

// Load JWT settings
var jwtKeyEnv = Environment.GetEnvironmentVariable("JWT_KEY");
if (string.IsNullOrEmpty(jwtKeyEnv) || jwtKeyEnv.Length < 32)
    throw new ArgumentException("JWT_KEY is missing or too short! It must be at least 32 characters long.", nameof(jwtKeyEnv));

var jwtKey = jwtKeyEnv;
var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? builder.Configuration["JwtSettings:Issuer"];
var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? builder.Configuration["JwtSettings:Audience"];
var jwtExpiration = Convert.ToInt32(Environment.GetEnvironmentVariable("JWT_EXPIRATION") ?? builder.Configuration["JwtSettings:ExpirationInMinutes"] ?? "60");

builder.Services.AddControllers()
    .AddJsonOptions(opt =>
    {
        opt.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        opt.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        opt.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddCors(opt =>
{
    opt.AddPolicy("AllowAllOrigins",
        policy => policy.AllowAnyOrigin()
                        .AllowAnyMethod()
                        .AllowAnyHeader());
});

builder.Services.AddSwaggerGen(opt =>
{
    opt.SwaggerDoc("v1", new OpenApiInfo { Title = "Tazq-App API", Version = "v1" });

    opt.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter 'Bearer' followed by your valid token."
    });

    opt.AddSecurityRequirement(new OpenApiSecurityRequirement
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
            Array.Empty<string>()
        }
    });
});

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

var keyBytes = Encoding.UTF8.GetBytes(jwtKey);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
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

builder.Services.AddSingleton<JwtService>();
builder.Services.AddSingleton(new CryptoService(jwtKey));

builder.Services.Configure<SmtpSettings>(opt =>
{
    opt.From = Environment.GetEnvironmentVariable("SMTP_FROM_EMAIL") ?? "";
    opt.Username = Environment.GetEnvironmentVariable("SMTP_USERNAME") ?? "";
    opt.Password = Environment.GetEnvironmentVariable("SMTP_PASSWORD") ?? "";
    opt.Port = int.Parse(Environment.GetEnvironmentVariable("SMTP_PORT") ?? "587");
    opt.Host = Environment.GetEnvironmentVariable("SMTP_SERVER") ?? "";
});

builder.Services.AddSingleton<ICustomEmailService, CustomEmailService>();
builder.Services.AddHostedService<ScheduledEmailService>();

var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
builder.WebHost.UseUrls($"http://*:{port}");

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.UseDeveloperExceptionPage();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

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

app.Use(async (context, next) =>
{
    if (!context.Request.Headers.TryGetValue("X-App-Signature", out var signature) ||
        signature != "tazq-maui-frontend")
    {
        context.Response.StatusCode = 403;
        await context.Response.WriteAsync("Frontend dışında erişim engellendi.");
        return;
    }

    await next();
});

app.UseCors("AllowAllOrigins");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();