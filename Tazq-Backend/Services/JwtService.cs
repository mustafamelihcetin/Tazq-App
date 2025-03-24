using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Configuration;

namespace Tazq_App.Services
{
	public class JwtService
	{
		private readonly IConfiguration _configuration;

		public JwtService(IConfiguration configuration)
		{
			_configuration = configuration;
		}

		public string GenerateToken(string userId, string role)
		{
			if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(role))
			{
				throw new ArgumentException("User ID or Role cannot be null or empty.");
			}

			var keyString = Environment.GetEnvironmentVariable("JWT_KEY") ?? _configuration["JwtSettings:SecretKey"];
			if (string.IsNullOrEmpty(keyString))
			{
				throw new Exception("JWT_KEY is missing! Make sure to set it as an environment variable.");
			}

			var key = Encoding.UTF8.GetBytes(keyString);
			var issuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? _configuration["JwtSettings:Issuer"];
			var audience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? _configuration["JwtSettings:Audience"];
			if (string.IsNullOrEmpty(audience))
			{
				throw new Exception("JWT_AUDIENCE is missing in configuration or environment!");
			}
			var expiration = Convert.ToInt32(Environment.GetEnvironmentVariable("JWT_EXPIRATION") ?? _configuration["JwtSettings:ExpirationInMinutes"] ?? "60");

			var claims = new[]
			{
				new Claim(JwtRegisteredClaimNames.Sub, userId),
				new Claim(ClaimTypes.NameIdentifier, userId),
				new Claim(ClaimTypes.Role, role),
				new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
				new Claim(JwtRegisteredClaimNames.Aud, audience) // audience claim eklendi
			};

			var securityKey = new SymmetricSecurityKey(key);
			var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

			var tokenDescriptor = new JwtSecurityToken(
				issuer: issuer,
				audience: audience,
				claims: claims,
				expires: DateTime.UtcNow.AddMinutes(expiration),
				signingCredentials: credentials
			);

			return new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);
		}
	}
}