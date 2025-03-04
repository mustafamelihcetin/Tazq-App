using Microsoft.EntityFrameworkCore;
using Tazq_App.Models;

namespace Tazq_App.Data
{
	public class AppDbContext : DbContext
	{
		public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
		{
			try
			{
				Console.WriteLine("Veritabanı başlatılıyor...");
				Database.EnsureCreated(); // Ensure database is created
				Console.WriteLine("Veritabanı kontrolü tamamlandı.");
			}
			catch (Exception ex)
			{
				Console.WriteLine($"Veritabanı başlatılamadı: {ex.Message}");
			}
		}

		public DbSet<TaskItem> Tasks { get; set; }
		public DbSet<User> Users { get; set; }
		public DbSet<UserNotificationPreferences> UserNotificationPreferences { get; set; }

		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			base.OnModelCreating(modelBuilder);

			modelBuilder.Entity<User>()
				.HasMany(u => u.Tasks)
				.WithOne(t => t.User)
				.HasForeignKey(t => t.UserId)
				.OnDelete(DeleteBehavior.Cascade);
		}
	}
}
