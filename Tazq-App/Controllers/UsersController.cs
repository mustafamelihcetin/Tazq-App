using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tazq_App.Data;
using Tazq_App.Models;

namespace Tazq_App.Controllers
{
	[Route("api/users")]
	[ApiController]
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
				return BadRequest("Username, Email ve Password boş olamaz.");
			}

			_context.Users.Add(user);
			await _context.SaveChangesAsync();
			return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, user);
		}
	}
}
