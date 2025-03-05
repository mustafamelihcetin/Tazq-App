using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Org.BouncyCastle.Crypto.Macs;
using System;
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

	// Register a new user
	[HttpPost("register")]
	public async Task<IActionResult> Register([FromBody] UserRegisterDto userDto)
	{
		if (await _context.Users.AnyAsync(u => u.Email == userDto.Email))
			return BadRequest("E-posta adresi zaten kullanımda.");

		using var rng = RandomNumberGenerator.Create();
		byte[] salt = new byte[16];
		rng.GetBytes(salt);

		using var pbkdf2 = new Rfc2898DeriveBytes(userDto.Password, salt, 100000, HashAlgorithmName.SHA256);
		byte[] passwordHash = pbkdf2.GetBytes(32);

		string passwordHashString = Convert.ToBase64String(passwordHash);
		string saltString = Convert.ToBase64String(salt);

		var user = new User
		{
			Name = userDto.Name,
			Email = userDto.Email,
			PasswordHash = passwordHashString,
			PasswordSalt = saltString,
			Role = "User"
		};

		_context.Users.Add(user);
		int result = await _context.SaveChangesAsync();

		if (result == 0)
		{
			Console.WriteLine("HATA - Kullanıcı veritabanına kaydedilemedi.");
			return StatusCode(500, "Veritabanına kayıt sırasında bir hata oluştu.");
		}

		return Ok("Kullanıcı başarıyla kaydedildi.");
	}


	// User Login
	[HttpPost("login")]
	public async Task<IActionResult> Login([FromBody] UserLoginDto userDto)
	{
		var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == userDto.Email);
		if (user == null)
		{
			Console.WriteLine("HATA - Kullanıcı bulunamadı.");
			return Unauthorized("Geçersiz e-posta veya şifre.");
		}

		if (string.IsNullOrEmpty(user.PasswordSalt) || string.IsNullOrEmpty(user.PasswordHash))
		{
			Console.WriteLine("HATA - Kullanıcının şifre hash veya salt değeri eksik.");
			return Unauthorized("Geçersiz giriş yöntemi. Google veya Apple ile giriş yapmalısınız.");
		}

		using var pbkdf2 = new Rfc2898DeriveBytes(userDto.Password, Convert.FromBase64String(user.PasswordSalt), 100000, HashAlgorithmName.SHA256);
		var computedHash = Convert.ToBase64String(pbkdf2.GetBytes(32));

		Console.WriteLine($"Beklenen Hash: {user.PasswordHash}");
		Console.WriteLine($"Hesaplanan Hash: {computedHash}");

		if (computedHash != user.PasswordHash)
		{
			Console.WriteLine("HATA - Şifre yanlış girildi.");
			return Unauthorized("Geçersiz e-posta veya şifre.");
		}

		var token = _jwtService.GenerateToken(user.Id.ToString(), user.Role ?? "User");
		Console.WriteLine($"Kullanıcı giriş yaptı: {user.Email}");
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