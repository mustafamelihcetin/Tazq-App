using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

[Route("api/users")]
[ApiController]
public class UsersController : ControllerBase
{
	private readonly AppDbContext _context;
	private readonly ICustomEmailService _emailService;
	private readonly JwtService _jwtService;

	public UsersController(AppDbContext context, ICustomEmailService emailService, JwtService jwtService)
	{
		_context = context;
		_emailService = emailService;
		_jwtService = jwtService;
	}

	[HttpPost("register")]
	public async Task<IActionResult> Register([FromBody] UserRegisterDto userDto)
	{
		if (await _context.Users.AnyAsync(u => u.Email == userDto.Email))
			return BadRequest("Email already in use.");

		using var hmac = new HMACSHA512();
		var user = new User
		{
			Username = userDto.Username,
			Email = userDto.Email,
			PasswordHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(userDto.Password)),
			PasswordSalt = hmac.Key
		};

		_context.Users.Add(user);
		await _context.SaveChangesAsync();

		string subject = "Welcome to Tazq-App!";
		string body = $"Hello {user.Username},\n\nWelcome to Tazq-App! We are excited to have you with us.";
		await _emailService.SendEmailAsync(user.Email, subject, body);

		return Ok(new { message = "User registered successfully and welcome email sent!" });
	}

	[HttpPost("login")]
	public async Task<IActionResult> Login([FromBody] UserLoginDto userDto)
	{
		var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == userDto.Username);
		if (user == null)
			return Unauthorized("Invalid username or password.");

		using var hmac = new HMACSHA512(user.PasswordSalt);
		var computedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(userDto.Password));

		if (!computedHash.SequenceEqual(user.PasswordHash))
			return Unauthorized("Invalid username or password.");

		var token = _jwtService.GenerateToken(user.Id.ToString(), user.Role);
		return Ok(new { token });
	}

	[HttpGet("me")]
	[Authorize]
	public async Task<IActionResult> GetCurrentUser()
	{
		var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
		if (userIdClaim == null)
			return Unauthorized("User ID not found in token.");

		int userId = int.Parse(userIdClaim);
		var user = await _context.Users.FindAsync(userId);

		if (user == null)
			return NotFound("User not found.");

		return Ok(new
		{
			user.Id,
			user.Username,
			user.Email,
			user.Role
		});
	}
}
