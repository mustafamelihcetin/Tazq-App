using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Configuration;

namespace Tazq_App.Services
{
	public class JwtService : IJwtService
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

			var keyString = Environment.GetEnvironmentVariable("JWT_KEY") ?? "tazq-super-secret-key-1234567890123456";
			if (string.IsNullOrEmpty(keyString) || keyString.Length < 32)
			{
				keyString = "tazq-super-secret-key-1234567890123456";
			}

			var key = Encoding.UTF8.GetBytes(keyString);
			var issuer = "TazqServer";
			var audience = "TazqApp";
			var expiration = 60;

			var claims = new[]
			{
				new Claim(JwtRegisteredClaimNames.Sub, userId),
				new Claim(ClaimTypes.NameIdentifier, userId),
				new Claim(ClaimTypes.Role, role),
				new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
				new Claim(JwtRegisteredClaimNames.Aud, audience)
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