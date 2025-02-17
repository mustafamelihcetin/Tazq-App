using Microsoft.EntityFrameworkCore;
using DotNetEnv;
using System;
using Tazq_App.Models;

namespace Tazq_App.Data
{
	public static class DataSeeder
	{
		public static void SeedDatabase(AppDbContext context)
		{
			// Ensure database is created and migrated
			context.Database.Migrate();

			// Load environment variables
			Env.Load();

			// Check if users exist
			if (!context.Users.Any())
			{
				var adminUser = new User
				{
					Username = Environment.GetEnvironmentVariable("DEFAULT_ADMIN_USERNAME") ?? "admin",
					Email = Environment.GetEnvironmentVariable("DEFAULT_ADMIN_EMAIL") ?? "admin@tazq.com",
					PasswordHash = BCrypt.Net.BCrypt.HashPassword(
						Environment.GetEnvironmentVariable("DEFAULT_ADMIN_PASSWORD") ?? "Admin123!"
					),
					Role = "Admin"
				};

				var testUser = new User
				{
					Username = Environment.GetEnvironmentVariable("DEFAULT_USER_USERNAME") ?? "testuser",
					Email = Environment.GetEnvironmentVariable("DEFAULT_USER_EMAIL") ?? "testuser@tazq.com",
					PasswordHash = BCrypt.Net.BCrypt.HashPassword(
						Environment.GetEnvironmentVariable("DEFAULT_USER_PASSWORD") ?? "User123!"
					),
					Role = "User" // Ensure default role is assigned
				};

				context.Users.AddRange(adminUser, testUser);
				context.SaveChanges();
			}
		}
	}
}
