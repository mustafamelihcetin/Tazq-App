using Microsoft.EntityFrameworkCore;
using Tazq_App.Models;

namespace Tazq_App.Data
{
	public static class DataSeeder
	{
		public static void SeedDatabase(AppDbContext context)
		{
			// Ensure database is created and migrated
			context.Database.Migrate();
		}
	}
}
