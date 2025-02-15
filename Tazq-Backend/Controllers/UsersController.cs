using Microsoft.AspNetCore.Authorization;
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

		// Retrieve all users (Admin only)
		[HttpGet]
		[Authorize(Roles = "Admin")]
		public async Task<IActionResult> GetUsers()
		{
			var users = await _context.Users.ToListAsync();
			return Ok(users);
		}

		// Retrieve a specific user by ID
		[HttpGet("{id}")]
		[Authorize]
		public async Task<IActionResult> GetUserById(int id)
		{
			var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userId == null)
				return Unauthorized("User not authenticated.");

			if (int.Parse(userId) != id && !User.IsInRole("Admin"))
				return Forbid("You are not authorized to view this user.");

			var user = await _context.Users.FindAsync(id);
			if (user == null)
				return NotFound("User not found.");

			return Ok(user);
		}

		// Register a new user
		[HttpPost("register")]
		public async Task<IActionResult> Register([FromBody] UserRegisterDto model)
		{
			if (_context.Users.Any(u => u.Email == model.Email || u.Username == model.Username))
				return BadRequest("Username or Email already exists.");

			var newUser = new User
			{
				Username = model.Username,
				Email = model.Email,
				PasswordHash = BCrypt.Net.BCrypt.HashPassword(model.Password)
			};

			_context.Users.Add(newUser);
			await _context.SaveChangesAsync();

			return CreatedAtAction(nameof(GetUserById), new { id = newUser.Id }, newUser);
		}

		// User login and generate JWT token
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
					new Claim(ClaimTypes.Name, user.Username),
					new Claim(ClaimTypes.Role, "User") // Default role
                }),
				Expires = DateTime.UtcNow.AddMinutes(60),
				SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature),
				Issuer = jwtIssuer,
				Audience = jwtAudience
			};

			var token = tokenHandler.CreateToken(tokenDescriptor);
			return Ok(new { token = tokenHandler.WriteToken(token) });
		}

		// Change user password
		[HttpPost("change-password")]
		[Authorize]
		public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto model)
		{
			var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (userId == null)
				return Unauthorized("User not authenticated.");

			var user = await _context.Users.FindAsync(int.Parse(userId));
			if (user == null)
				return NotFound("User not found.");

			if (!BCrypt.Net.BCrypt.Verify(model.OldPassword, user.PasswordHash))
			{
				return BadRequest("Old password is incorrect.");
			}

			user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(model.NewPassword);
			_context.Users.Update(user);
			await _context.SaveChangesAsync();

			return Ok("Password updated successfully.");
		}
	}

	// DTO for user registration
	public class UserRegisterDto
	{
		public string Username { get; set; }
		public string Email { get; set; }
		public string Password { get; set; }
	}

	// DTO for user login
	public class UserLoginDto
	{
		public string Username { get; set; }
		public string Password { get; set; }
	}

	// DTO for changing password
	public class ChangePasswordDto
	{
		public string OldPassword { get; set; }
		public string NewPassword { get; set; }
	}
}
