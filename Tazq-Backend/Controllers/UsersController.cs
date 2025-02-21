using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
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

	// Registers a new user
	[HttpPost("register")]
	public async Task<IActionResult> Register([FromBody] UserRegisterDto userDto)
	{
		if (await _context.Users.AnyAsync(u => u.Email == userDto.Email))
			return BadRequest("Email already in use.");

		using var hmac = new HMACSHA512();
		var passwordHash = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(userDto.Password)));
		var passwordSalt = Convert.ToBase64String(hmac.Key);

		var user = new User
		{
			Name = userDto.Name,
			Email = userDto.Email,
			PasswordHash = passwordHash,
			PasswordSalt = passwordSalt
		};

		_context.Users.Add(user);

		try
		{
			await _context.SaveChangesAsync();
		}
		catch (Exception ex)
		{
			return StatusCode(500, new { message = "Database error", error = ex.Message });
		}

		string subject = "Welcome to Tazq-App!";
		string body = $"Hello {user.Name},\n\nWelcome to Tazq-App! We are excited to have you with us.";

		try
		{
			await _emailService.SendEmailAsync(user.Email, subject, body);
		}
		catch (Exception ex)
		{
			return StatusCode(500, new { message = "Email sending failed", error = ex.Message });
		}

		return Ok(new { message = "User registered successfully and welcome email sent!" });
	}

	// Logs in a user
	[HttpPost("login")]
	public async Task<IActionResult> Login([FromBody] UserLoginDto userDto)
	{
		var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == userDto.Email);
		if (user == null)
			return Unauthorized("Invalid email or password.");

		if (string.IsNullOrEmpty(user.PasswordSalt) || string.IsNullOrEmpty(user.PasswordHash))
			return Unauthorized("Invalid login method. Use Google or Apple login.");

		using var hmac = new HMACSHA512(Convert.FromBase64String(user.PasswordSalt));
		var computedHash = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(userDto.Password)));

		if (computedHash != user.PasswordHash)
			return Unauthorized("Invalid email or password.");

		var token = _jwtService.GenerateToken(user.Id.ToString(), user.Role);
		return Ok(new { token });
	}

		// Adds a phone number to the user's profile
	[HttpPost("add-phone")]
	[Authorize]
	public async Task<IActionResult> AddPhoneNumber([FromBody] PhoneNumberDto phoneDto)
	{
		var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
		if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
			return Unauthorized("User ID not found in token.");

		var user = await _context.Users.FindAsync(userId);
		if (user == null)
			return NotFound("User not found.");

		if (!string.IsNullOrEmpty(user.PhoneNumber))
			return BadRequest("A phone number is already added.");

		user.PhoneNumber = phoneDto.PhoneNumber;
		user.IsPhoneVerified = false;

		_context.Users.Update(user);
		await _context.SaveChangesAsync();

		return Ok(new { message = "Phone number added successfully, but not verified yet." });
	}

	// Updates an existing phone number
	[HttpPatch("update-phone")]
	[Authorize]
	public async Task<IActionResult> UpdatePhoneNumber([FromBody] PhoneNumberDto phoneDto)
	{
		var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
		if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
			return Unauthorized("User ID not found in token.");

		var user = await _context.Users.FindAsync(userId);
		if (user == null)
			return NotFound("User not found.");

		user.PhoneNumber = phoneDto.PhoneNumber;
		user.IsPhoneVerified = false;

		_context.Users.Update(user);
		await _context.SaveChangesAsync();

		return Ok(new { message = "Phone number updated successfully, but not verified yet." });
	}
	[HttpPatch("update-notification-preferences")]
	[Authorize]
	public async Task<IActionResult> UpdateNotificationPreferences([FromBody] UserNotificationPreferences preferencesDto)
	{
		var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
		if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
			return Unauthorized("User ID not found in token.");

		var user = await _context.Users.Include(u => u.NotificationPreferences).FirstOrDefaultAsync(u => u.Id == userId);
		if (user == null)
			return NotFound("User not found.");

		if (user.NotificationPreferences == null)
		{
			user.NotificationPreferences = new UserNotificationPreferences
			{
				UserId = userId,
				ReceiveWeeklySummary = preferencesDto.ReceiveWeeklySummary,
				ReminderDaysBeforeDue = preferencesDto.ReminderDaysBeforeDue,
				WeeklySummaryDay = preferencesDto.WeeklySummaryDay
			};
			_context.UserNotificationPreferences.Add(user.NotificationPreferences);
		}
		else
		{
			user.NotificationPreferences.ReceiveWeeklySummary = preferencesDto.ReceiveWeeklySummary;
			user.NotificationPreferences.ReminderDaysBeforeDue = preferencesDto.ReminderDaysBeforeDue;
			user.NotificationPreferences.WeeklySummaryDay = preferencesDto.WeeklySummaryDay;
		}

		await _context.SaveChangesAsync();
		return Ok(new { message = "Notification preferences updated successfully." });
	}
	[HttpPost("upload-profile-picture")]
	[Authorize]
	public async Task<IActionResult> UploadProfilePicture([FromForm] IFormFile file)
	{
		var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
		if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
			return Unauthorized("User ID not found in token.");

		var user = await _context.Users.FindAsync(userId);
		if (user == null)
			return NotFound("User not found.");

		if (file == null || file.Length == 0)
			return BadRequest("Invalid file.");

		var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "profile_pictures");
		if (!Directory.Exists(uploadsFolder))
			Directory.CreateDirectory(uploadsFolder);

		var fileName = $"{userId}_{Path.GetFileName(file.FileName)}";
		var filePath = Path.Combine(uploadsFolder, fileName);

		using (var stream = new FileStream(filePath, FileMode.Create))
		{
			await file.CopyToAsync(stream);
		}

		user.ProfilePicture = $"/profile_pictures/{fileName}";
		_context.Users.Update(user);
		await _context.SaveChangesAsync();

		return Ok(new { message = "Profile picture uploaded successfully.", url = user.ProfilePicture });
	}
	// Retrieves the current user details
	[HttpGet("me")]
	[Authorize]
	public async Task<IActionResult> GetCurrentUser()
	{
		var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
		if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
			return Unauthorized("User ID not found in token.");

		var user = await _context.Users.FindAsync(userId);
		if (user == null)
			return NotFound("User not found.");

		return Ok(new
		{
			user.Id,
			user.Name,
			user.Email,
			user.Role,
			user.PhoneNumber,
			user.IsPhoneVerified,
			ProfilePicture = user.ProfilePicture ?? "/default-profile.png"
		});
	}
}
