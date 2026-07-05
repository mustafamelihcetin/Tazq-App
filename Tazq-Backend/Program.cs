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
using AspNetCoreRateLimit.Redis;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Load environment variables from .env file
Env.Load();

// Load app signature for request validation
var appSignature = Environment.GetEnvironmentVariable("APP_SIGNATURE") ?? "tazq-expo-frontend";

// Bellek-içi log deposu + sağlayıcı — admin panelden SSH'siz log görüntüleme (son 500 kayıt).
var logStore = new Tazq_App.Services.InMemoryLogStore(500);
builder.Services.AddSingleton(logStore);
builder.Logging.AddProvider(new Tazq_App.Services.InMemoryLoggerProvider(logStore, Microsoft.Extensions.Logging.LogLevel.Warning));

// Load JWT settings
var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY")
    ?? throw new InvalidOperationException("JWT_KEY environment variable is required and must be at least 32 characters.");
if (jwtKey.Length < 32)
    throw new InvalidOperationException("JWT_KEY must be at least 32 characters long.");
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

// Rate Limiting Services with Redis
var redisUrl = Environment.GetEnvironmentVariable("REDIS_URL") ?? "localhost:6379,abortConnect=false";

var isContainer = Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER") == "true";

if (isContainer)
{
    // Add IDistributedCache backed by Redis (Required by AspNetCoreRateLimit.Redis)
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = redisUrl;
        options.InstanceName = "TazqRateLimit_";
    });
    builder.Services.AddSingleton<IConnectionMultiplexer>(provider => ConnectionMultiplexer.Connect(redisUrl));
    builder.Services.AddRedisRateLimiting();
}
else
{
    // Local dev: use InMemory cache to prevent crashes when Docker Redis fails
    builder.Services.AddMemoryCache();
    builder.Services.AddInMemoryRateLimiting();
}

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
        },
        // Strict limit to prevent email spam / brute force on forgot password
        new RateLimitRule
        {
            Endpoint = "post:/api/users/forgot-password",
            Period = "1h",
            Limit = 5
        },
        // Strict limit to prevent brute force on reset password
        new RateLimitRule
        {
            Endpoint = "post:/api/users/reset-password",
            Period = "1h",
            Limit = 5
        }
    };
    opt.QuotaExceededMessage = "Çok fazla istek gönderdiniz. Güvenliğiniz için sınırlandırıldınız. Lütfen daha sonra tekrar deneyin.";
});

builder.Services.AddHealthChecks();

var allowedOrigins = (Environment.GetEnvironmentVariable("ALLOWED_ORIGINS") ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

if (allowedOrigins.Length == 0)
    Console.WriteLine("WARNING: ALLOWED_ORIGINS env var is not set — CORS wildcard is active. Set it in .env for production.");

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

// Auto-route for local development (not in Docker)
if (Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER") != "true")
{
    if (pgHost == "tazq-db") pgHost = "localhost";
    if (pgPort == "5432") pgPort = "65432";
}

if (string.IsNullOrWhiteSpace(pgHost) || string.IsNullOrWhiteSpace(pgDb))
    throw new Exception("PostgreSQL environment variables are missing!");

var pgConnectionString = $"Host={pgHost};Port={pgPort};Database={pgDb};Username={pgUser};Password={pgPassword};SslMode=Prefer;Trust Server Certificate=true;";

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(pgConnectionString)
           .ConfigureWarnings(w => w
               .Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)
               // Soft-delete global query filter (User) ile zorunlu ilişkiler arasındaki uyarı bilinçlidir:
               // çocuk kayıtlar UserId ile sorgulanır (User join'lenmez), silinmiş kullanıcının verisi grace boyunca korunur.
               .Ignore(Microsoft.EntityFrameworkCore.Diagnostics.CoreEventId.PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning)));

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

builder.Services.AddSingleton<IJwtService, JwtService>();
// Grace süresi dolmuş silinmiş hesapları kalıcı temizleyen arka plan servisi
builder.Services.AddHostedService<Tazq_App.Services.AccountPurgeService>();
var encryptionKey = Environment.GetEnvironmentVariable("ENCRYPTION_KEY") ?? jwtKey;
builder.Services.AddSingleton<ICryptoService>(new CryptoService(encryptionKey));

builder.Services.Configure<SmtpSettings>(opt =>
{
    var section = builder.Configuration.GetSection("SmtpSettings");
    opt.From = Environment.GetEnvironmentVariable("SMTP_FROM_EMAIL") ?? section["From"] ?? "";
    opt.Username = Environment.GetEnvironmentVariable("SMTP_USERNAME") ?? section["Username"] ?? "";
    opt.Password = Environment.GetEnvironmentVariable("SMTP_PASSWORD") ?? section["Password"] ?? "";
    opt.Host = Environment.GetEnvironmentVariable("SMTP_SERVER") ?? section["Host"] ?? "";
    
    var portEnv = Environment.GetEnvironmentVariable("SMTP_PORT");
    if (!string.IsNullOrEmpty(portEnv) && int.TryParse(portEnv, out int p))
    {
        opt.Port = p;
    }
    else
    {
        opt.Port = int.TryParse(section["Port"], out int sp) ? sp : 587;
    }
});

builder.Services.AddSingleton<ICustomEmailService, CustomEmailService>();
builder.Services.AddSingleton<IGoogleTokenValidator, GoogleTokenValidator>();
builder.Services.AddSingleton<IAppleTokenValidator, AppleTokenValidator>();
builder.Services.AddScoped<ITaskService, TaskService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IFocusSessionService, FocusSessionService>();
builder.Services.AddHttpClient();
builder.Services.AddScoped<IGroqService, GroqService>();
builder.Services.AddHostedService<ScheduledEmailService>();

var port = Environment.GetEnvironmentVariable("PORT") ?? "5201";
builder.WebHost.UseUrls($"http://*:{port}");

var app = builder.Build();

var forwardedOptions = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};
// Trust Caddy reverse proxy on the same Docker network
forwardedOptions.KnownNetworks.Clear();
forwardedOptions.KnownProxies.Clear();
forwardedOptions.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(
    System.Net.IPAddress.Parse("172.0.0.0"), 8));
app.UseForwardedHeaders(forwardedOptions);

if (app.Environment.IsDevelopment())
    app.UseDeveloperExceptionPage();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var maxRetries = 10;
    var delay = 5000;
    for (int i = 0; i < maxRetries; i++)
    {
        try
        {
            db.Database.Migrate();
            break;
        }
        catch (Exception)
        {
            if (i == maxRetries - 1)
            {
                Console.WriteLine("!!! UYARI: Veritabanina baglanilamadi. Sistem veritabani olmadan baslatiliyor. API cagrilarinda 500 hatasi alabilirsiniz.");
                break;
            }
            Console.WriteLine($"Veritabanına bağlanılamadı, tekrar deneniyor... ({i + 1}/{maxRetries})");
            Thread.Sleep(delay);
        }
    }

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

    // Promote any email listed in ADMIN_EMAILS to Admin role
    var extraAdmins = (Environment.GetEnvironmentVariable("ADMIN_EMAILS") ?? "")
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    bool changed = false;
    foreach (var email in extraAdmins)
    {
        var u = db.Users.FirstOrDefault(u => u.Email == email);
        if (u != null && u.Role != "Admin") { u.Role = "Admin"; changed = true; }
    }
    if (changed) db.SaveChanges();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

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
    if (app.Environment.IsDevelopment())
    {
        await next();
        return;
    }

    // Bypass signature check for the web-based password reset endpoints
    if (context.Request.Path.Value != null && (
        (context.Request.Method == "GET" && context.Request.Path.Value.Equals("/api/users/reset-password-form", StringComparison.OrdinalIgnoreCase)) ||
        (context.Request.Method == "POST" && context.Request.Path.Value.Equals("/api/users/reset-password", StringComparison.OrdinalIgnoreCase))
    ))
    {
        await next();
        return;
    }

    if (!context.Request.Headers.TryGetValue("X-App-Signature", out var signature) ||
        !string.Equals(signature.ToString(), appSignature, StringComparison.OrdinalIgnoreCase))
    {
        context.Response.StatusCode = 403;
        await context.Response.WriteAsync("Forbidden.");
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