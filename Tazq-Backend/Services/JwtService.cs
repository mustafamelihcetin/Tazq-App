
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
			var issuer = _configuration["JwtSettings:Issuer"];
			var audience = _configuration["JwtSettings:Audience"];
			var expiration = Convert.ToInt32(_configuration["JwtSettings:ExpirationInMinutes"] ?? "60");

			var claims = new[]
			{
				new Claim(JwtRegisteredClaimNames.Sub, userId),
				new Claim(ClaimTypes.NameIdentifier, userId), // Kullanıcı ID kesin olarak eklendi
				new Claim(ClaimTypes.Role, role),
				new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
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
