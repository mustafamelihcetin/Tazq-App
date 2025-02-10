using Microsoft.EntityFrameworkCore;
using Tazq_App.Models;

namespace Tazq_App.Data
{
	public class AppDbContext : DbContext
	{
		public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

		public DbSet<TaskItem> Tasks { get; set; }
		public DbSet<User> Users { get; set; }
	}
}
