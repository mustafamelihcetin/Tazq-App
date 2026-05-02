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
using FluentValidation;
using FluentValidation.AspNetCore;
using Tazq_App.Validators;
using Microsoft.AspNetCore.HttpOverrides;
using AspNetCoreRateLimit;

var builder = WebApplication.CreateBuilder(args);

// Load environment variables from .env file
Env.Load();

// Load app signature for request validation
var appSignature = Environment.GetEnvironmentVariable("APP_SIGNATURE") ?? "tazq-expo-frontend";

// Load JWT settings
var jwtKeyEnv = Environment.GetEnvironmentVariable("JWT_KEY") ?? "tazq-super-secret-key-1234567890123456";
if (string.IsNullOrEmpty(jwtKeyEnv) || jwtKeyEnv.Length < 32)
    jwtKeyEnv = "tazq-super-secret-key-1234567890123456"; // Ensure length

var jwtKey = jwtKeyEnv;
var jwtIssuer = "TazqServer";
var jwtAudience = "TazqApp";

builder.Services.AddControllers()
    .AddJsonOptions(opt =>
    {
        opt.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        opt.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        opt.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        opt.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<UserRegisterDtoValidator>();

builder.Services.AddEndpointsApiExplorer();

// Rate Limiting Services
builder.Services.AddMemoryCache();
builder.Services.AddInMemoryRateLimiting();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
builder.Services.Configure<IpRateLimitOptions>(opt =>
{
    opt.GeneralRules = new List<RateLimitRule>
    {
        new RateLimitRule
        {
            Endpoint = "*",
            Period = "1m",
            Limit = 100
        },
        new RateLimitRule
        {
            Endpoint = "*",
            Period = "1h",
            Limit = 1000
        }
    };
});

builder.Services.AddHealthChecks();

var allowedOrigins = (Environment.GetEnvironmentVariable("ALLOWED_ORIGINS") ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(opt =>
{
    opt.AddPolicy("TazqCorsPolicy", policy =>
    {
        if (allowedOrigins.Length > 0)
            policy.WithOrigins(allowedOrigins).AllowAnyMethod().AllowAnyHeader();
        else
            policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
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

var pgConnectionString = $"Host={pgHost};Port={pgPort};Database={pgDb};Username={pgUser};Password={pgPassword};SslMode=Prefer;Trust Server Certificate=true;";

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(pgConnectionString)
           .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));

var keyBytes = Encoding.UTF8.GetBytes(jwtKey);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(keyBytes)
        };
    });

builder.Services.AddSingleton<IJwtService, JwtService>();
builder.Services.AddSingleton<ICryptoService>(new CryptoService(jwtKey));

builder.Services.Configure<SmtpSettings>(opt =>
{
    opt.From = Environment.GetEnvironmentVariable("SMTP_FROM_EMAIL") ?? "";
    opt.Username = Environment.GetEnvironmentVariable("SMTP_USERNAME") ?? "";
    opt.Password = Environment.GetEnvironmentVariable("SMTP_PASSWORD") ?? "";
    opt.Port = int.Parse(Environment.GetEnvironmentVariable("SMTP_PORT") ?? "587");
    opt.Host = Environment.GetEnvironmentVariable("SMTP_SERVER") ?? "";
});

builder.Services.AddSingleton<ICustomEmailService, CustomEmailService>();
builder.Services.AddScoped<ITaskService, TaskService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IFocusSessionService, FocusSessionService>();
builder.Services.AddHttpClient();
builder.Services.AddScoped<IGroqService, GroqService>();
builder.Services.AddHostedService<ScheduledEmailService>();

var port = Environment.GetEnvironmentVariable("PORT") ?? "5200";
builder.WebHost.UseUrls($"http://*:{port}");

var app = builder.Build();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

if (app.Environment.IsDevelopment())
    app.UseDeveloperExceptionPage();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    var adminEmail = Environment.GetEnvironmentVariable("ADMIN_EMAIL");
    var adminPassword = Environment.GetEnvironmentVariable("ADMIN_PASSWORD");

    if (!string.IsNullOrEmpty(adminEmail) && !string.IsNullOrEmpty(adminPassword))
    {
        var existing = db.Users.FirstOrDefault(u => u.Email == adminEmail);
        if (existing == null)
        {
            var salt = System.Security.Cryptography.RandomNumberGenerator.GetBytes(16);
            using var pbkdf2 = new System.Security.Cryptography.Rfc2898DeriveBytes(
                adminPassword, salt, 100000, System.Security.Cryptography.HashAlgorithmName.SHA256);
            var hash = pbkdf2.GetBytes(32);

            db.Users.Add(new Tazq_App.Models.User
            {
                Name = "Admin",
                Email = adminEmail,
                PasswordHash = Convert.ToBase64String(hash),
                PasswordSalt = Convert.ToBase64String(salt),
                Role = "Admin"
            });
            db.SaveChanges();
        }
    }
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
            var isDev = app.Environment.IsDevelopment();
            
            var result = JsonSerializer.Serialize(new
            {
                StatusCode = 500,
                Message = isDev ? ex.Message : "Sunucu tarafında bir hata oluştu.",
                StackTrace = isDev ? ex.StackTrace : null
            });

            await context.Response.WriteAsync(result);
        }
    });
});

app.Use(async (context, next) =>
{
    Console.WriteLine($">>> İstek Geldi: {context.Request.Method} {context.Request.Path}");
    if (app.Environment.IsDevelopment())
    {
        await next();
        return;
    }

    if (!context.Request.Headers.TryGetValue("X-App-Signature", out var signature))
    {
        context.Response.StatusCode = 403;
        await context.Response.WriteAsync("Signature missing.");
        return;
    }
    
    if (!string.Equals(signature.ToString(), appSignature, StringComparison.OrdinalIgnoreCase))
    {
        context.Response.StatusCode = 403;
        await context.Response.WriteAsync("Signature mismatch.");
        return;
    }

    await next();
});

app.UseIpRateLimiting();
app.MapHealthChecks("/health");
app.UseCors("TazqCorsPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.MapGet("/privacy", () => Results.Content("<h1>Privacy Policy</h1><p>Tazq-App, verilerinizi sadece cihazınızda ve güvenli sunucularımızda saklar. Verileriniz üçüncü şahıslarla paylaşılmaz.</p>", "text/html"));
app.MapGet("/terms", () => Results.Content("<h1>Terms of Service</h1><p>Tazq-App'i kullanarak şartlarımızı kabul etmiş sayılırsınız.</p>", "text/html"));

app.Run();