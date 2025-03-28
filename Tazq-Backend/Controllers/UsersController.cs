using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;
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
	[AllowAnonymous]
	public async Task<IActionResult> Register([FromBody] UserRegisterDto userDto)
	{
		if (!ModelState.IsValid)
			return BadRequest(ModelState);

		if (await _context.Users.AnyAsync(u => u.Email == userDto.Email))
			return BadRequest("E-posta adresi zaten kullanımda.");

		using var rng = RandomNumberGenerator.Create();
		byte[] salt = new byte[16];
		rng.GetBytes(salt);

		using var pbkdf2 = new Rfc2898DeriveBytes(userDto.Password, salt, 100000, HashAlgorithmName.SHA256);
		byte[] passwordHash = pbkdf2.GetBytes(32);

		var user = new User
		{
			Name = userDto.Name,
			Email = userDto.Email,
			PasswordHash = Convert.ToBase64String(passwordHash),
			PasswordSalt = Convert.ToBase64String(salt),
			Role = "User"
		};

		_context.Users.Add(user);
		await _context.SaveChangesAsync();

		return Ok("Kullanıcı başarıyla kaydedildi.");
	}

	[HttpPost("login")]
	[AllowAnonymous]
	public async Task<IActionResult> Login([FromBody] UserLoginDto userDto)
	{
		if (!ModelState.IsValid)
			return BadRequest(ModelState);

		var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == userDto.Email);
		if (user == null)
			return Unauthorized("Geçersiz e-posta veya şifre.");

		if (string.IsNullOrEmpty(user.PasswordSalt) || string.IsNullOrEmpty(user.PasswordHash))
			return Unauthorized("Geçersiz giriş yöntemi. Google veya Apple ile giriş yapmalısınız.");

		using var pbkdf2 = new Rfc2898DeriveBytes(userDto.Password, Convert.FromBase64String(user.PasswordSalt), 100000, HashAlgorithmName.SHA256);
		var computedHash = Convert.ToBase64String(pbkdf2.GetBytes(32));

		if (computedHash != user.PasswordHash)
			return Unauthorized("Geçersiz e-posta veya şifre.");

		var token = _jwtService.GenerateToken(user.Id.ToString(), user.Role ?? "User");
		return Ok(new { token });
	}

	[HttpPost("add-phone")]
	[Authorize]
	public async Task<IActionResult> AddPhoneNumber([FromBody] PhoneNumberDto phoneDto)
	{
		var userId = GetUserId();
		if (userId == null) return Unauthorized();

		var user = await _context.Users.FindAsync(userId);
		if (user == null) return NotFound();

		if (!string.IsNullOrEmpty(user.PhoneNumber))
			return BadRequest("A phone number is already added.");

		user.PhoneNumber = phoneDto.PhoneNumber;
		user.IsPhoneVerified = false;

		_context.Users.Update(user);
		await _context.SaveChangesAsync();

		return Ok(new { message = "Phone number added successfully." });
	}

	[HttpPatch("update-phone")]
	[Authorize]
	public async Task<IActionResult> UpdatePhoneNumber([FromBody] PhoneNumberDto phoneDto)
	{
		var userId = GetUserId();
		if (userId == null) return Unauthorized();

		var user = await _context.Users.FindAsync(userId);
		if (user == null) return NotFound();

		user.PhoneNumber = phoneDto.PhoneNumber;
		user.IsPhoneVerified = false;

		_context.Users.Update(user);
		await _context.SaveChangesAsync();

		return Ok(new { message = "Phone number updated successfully." });
	}

	[HttpPatch("update-notification-preferences")]
	[Authorize]
	public async Task<IActionResult> UpdateNotificationPreferences([FromBody] UserNotificationPreferences preferencesDto)
	{
		var userId = GetUserId();
		if (userId == null) return Unauthorized();

		var user = await _context.Users.Include(u => u.NotificationPreferences).FirstOrDefaultAsync(u => u.Id == userId);
		if (user == null) return NotFound();

		if (user.NotificationPreferences == null)
		{
			user.NotificationPreferences = new UserNotificationPreferences
			{
				UserId = userId.Value,
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
		return Ok(new { message = "Notification preferences updated." });
	}

	[HttpPost("upload-profile-picture")]
	[Authorize]
	public async Task<IActionResult> UploadProfilePicture([FromForm] IFormFile file)
	{
		var userId = GetUserId();
		if (userId == null) return Unauthorized();

		var user = await _context.Users.FindAsync(userId);
		if (user == null) return NotFound();

		if (file == null || file.Length == 0)
			return BadRequest("Invalid file.");

		var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "profile_pictures");
		if (!Directory.Exists(uploadsFolder))
			Directory.CreateDirectory(uploadsFolder);

		var fileName = $"{userId}_{Path.GetFileName(file.FileName)}";
		var filePath = Path.Combine(uploadsFolder, fileName);

		using var stream = new FileStream(filePath, FileMode.Create);
		await file.CopyToAsync(stream);

		user.ProfilePicture = $"/profile_pictures/{fileName}";
		_context.Users.Update(user);
		await _context.SaveChangesAsync();

		return Ok(new { message = "Profile picture uploaded.", url = user.ProfilePicture });
	}

	[HttpGet("me")]
	[Authorize]
	public async Task<IActionResult> GetCurrentUser()
	{
		var userId = GetUserId();
		if (userId == null) return Unauthorized();

		var user = await _context.Users.FindAsync(userId);
		if (user == null) return NotFound();

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

	[HttpPost("forgot-password")]
	[AllowAnonymous]
	public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
	{
		if (!ModelState.IsValid)
			return BadRequest(ModelState);

		var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
		if (user == null)
			return Ok("Eğer kullanıcı varsa, e-posta gönderildi.");

		var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
		var expiration = DateTime.UtcNow.AddHours(1);

		var resetToken = new PasswordResetToken
		{
			UserId = user.Id,
			Token = token,
			Expiration = expiration
		};

		_context.PasswordResetTokens.Add(resetToken);
		await _context.SaveChangesAsync();

		try
		{
			var mailBody = $@"
						   Merhaba,<br/><br/>
						   Şifrenizi sıfırlamak için aşağıdaki kodu uygulamadaki şifre sıfırlama ekranında kullanabilirsiniz:<br/><br/>
						   <b>{token}</b><br/><br/>
						   İyi günler dileriz,<br/>
						   Tazq Ekibi
						   ";

			await _emailService.SendEmailAsync(user.Email, "Şifre Sıfırlama", mailBody);
			return Ok("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
		}
		catch (Exception ex)
		{
			// LOG: ex.Message
			return StatusCode(500, $"Mail gönderim hatası: {ex.Message}");
		}
	}

	[HttpPost("reset-password")]
	[AllowAnonymous]
	public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
	{
		if (!ModelState.IsValid)
			return BadRequest(ModelState);

		var tokenEntry = await _context.PasswordResetTokens
			.Include(t => t.User)
			.FirstOrDefaultAsync(t => t.Token == request.Token);

		if (tokenEntry == null || tokenEntry.Expiration < DateTime.UtcNow)
			return BadRequest("Geçersiz veya süresi dolmuş bağlantı.");

		using var rng = RandomNumberGenerator.Create();
		byte[] salt = new byte[16];
		rng.GetBytes(salt);

		using var pbkdf2 = new Rfc2898DeriveBytes(request.NewPassword, salt, 100000, HashAlgorithmName.SHA256);
		byte[] passwordHash = pbkdf2.GetBytes(32);

		tokenEntry.User.PasswordHash = Convert.ToBase64String(passwordHash);
		tokenEntry.User.PasswordSalt = Convert.ToBase64String(salt);

		_context.Users.Update(tokenEntry.User);
		_context.PasswordResetTokens.Remove(tokenEntry);
		await _context.SaveChangesAsync();

		return Ok("Şifreniz başarıyla güncellendi.");
	}

	private int? GetUserId()
	{
		var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
		if (int.TryParse(userIdClaim, out int userId))
			return userId;
		return null;
	}

	public class ForgotPasswordRequest
	{
		public string Email { get; set; } = string.Empty;
	}

	public class ResetPasswordRequest
	{
		public string Token { get; set; } = string.Empty;
		public string NewPassword { get; set; } = string.Empty;
	}
}