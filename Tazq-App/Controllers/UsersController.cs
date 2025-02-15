using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
	[Route("api/users")]
	[ApiController]
	[ApiExplorerSettings(IgnoreApi = false)] // Ensure this controller is visible in Swagger
	public class UsersController : ControllerBase
	{
		private readonly AppDbContext _context;

		public UsersController(AppDbContext context)
		{
			_context = context;
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
				return BadRequest("Username, Email, and Password cannot be empty.");
			}

			user.PasswordHash = PasswordHasher.HashPassword(user.PasswordHash);

			_context.Users.Add(user);
			await _context.SaveChangesAsync();
			return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, user);
		}

		[AllowAnonymous]
		[HttpPost("login")]
		public async Task<IActionResult> Login([FromBody] UserLoginDto loginDto)
		{
			var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == loginDto.Username);
			if (user == null || !PasswordHasher.VerifyPassword(loginDto.Password, user.PasswordHash))
			{
				return Unauthorized("Invalid username or password.");
			}

			return Ok(new { message = "Login successful" });
		}
	}

	public class UserLoginDto
	{
		public string Username { get; set; }
		public string Password { get; set; }
	}
}
