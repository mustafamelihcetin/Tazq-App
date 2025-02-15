using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BCrypt.Net;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
	[Route("api/users")]
	[ApiController]
	[ApiExplorerSettings(IgnoreApi = false)] // Ensure Swagger does not ignore this controller
	public class UsersController : ControllerBase
	{
		private readonly AppDbContext _context;
		private readonly IConfiguration _configuration;

		public UsersController(AppDbContext context, IConfiguration configuration)
		{
			_context = context;
			_configuration = configuration;
		}

		[HttpGet]
		public async Task<IActionResult> GetUsers()
		{
			var users = await _context.Users.ToListAsync();
			return Ok(users);
		}

		[HttpPost]
		public async Task<IActionResult> CreateUser(User user)
		{
			if (string.IsNullOrEmpty(user.Username) || string.IsNullOrEmpty(user.Email) || string.IsNullOrEmpty(user.PasswordHash))
			{
				return BadRequest("Username, Email and Password cannot be empty.");
			}

			user.PasswordHash = PasswordHasher.HashPassword(user.PasswordHash);
			_context.Users.Add(user);
			await _context.SaveChangesAsync();
			return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, user);
		}

		[HttpPost("login")]
		public async Task<IActionResult> Login([FromBody] UserLoginDto loginDto)
		{
			var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY");
			var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER");
			var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE");

			if (string.IsNullOrEmpty(jwtKey) || string.IsNullOrEmpty(jwtIssuer) || string.IsNullOrEmpty(jwtAudience))
			{
				return StatusCode(500, "JWT environment variables are not set properly!");
			}

			var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == loginDto.Username);
			if (user == null || !BCrypt.Net.BCrypt.Verify(loginDto.Password, user.PasswordHash))
			{
				return Unauthorized("Invalid username or password");
			}

			var tokenHandler = new JwtSecurityTokenHandler();
			var key = Encoding.UTF8.GetBytes(jwtKey);
			var tokenDescriptor = new SecurityTokenDescriptor
			{
				Subject = new ClaimsIdentity(new[]
				{
					new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
					new Claim(ClaimTypes.Name, user.Username)
				}),
				Expires = DateTime.UtcNow.AddMinutes(60),
				SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature),
				Issuer = jwtIssuer,
				Audience = jwtAudience
			};

			var token = tokenHandler.CreateToken(tokenDescriptor);
			return Ok(new { token = tokenHandler.WriteToken(token) });
		}
	}

	public class UserLoginDto
	{
		public string Username { get; set; }
		public string Password { get; set; }
	}
}
