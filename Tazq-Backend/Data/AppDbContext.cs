using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Tazq_App.Models;

namespace Tazq_App.Data
{
	public class AppDbContext : DbContext
	{
		private readonly ILogger<AppDbContext>? _logger;

		public AppDbContext(DbContextOptions<AppDbContext> options, ILogger<AppDbContext>? logger = null) : base(options)
		{
			_logger = logger;
			try
			{
				_logger?.LogInformation("Veritabanı başlatılıyor...");
				//Database.Migrate();
				_logger?.LogInformation("Veritabanı kontrolü tamamlandı.");
			}
			catch (Exception ex)
			{
				_logger?.LogError(ex, "Veritabanı başlatılamadı: {Message}", ex.Message);
			}
		}


		public DbSet<TaskItem> Tasks { get; set; }
		public DbSet<User> Users { get; set; }
		public DbSet<UserNotificationPreferences> UserNotificationPreferences { get; set; }
		public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }


		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			base.OnModelCreating(modelBuilder);

			modelBuilder.Entity<User>()
				.HasMany(u => u.Tasks)
				.WithOne(t => t.User)
				.HasForeignKey(t => t.UserId)
				.OnDelete(DeleteBehavior.Cascade);

			modelBuilder.Entity<User>()
				.HasOne(u => u.NotificationPreferences)
				.WithOne(p => p.User)
				.HasForeignKey<UserNotificationPreferences>(p => p.UserId)
				.OnDelete(DeleteBehavior.Cascade);

			modelBuilder.Entity<PasswordResetToken>()
				.HasOne(t => t.User)
				.WithMany()
				.HasForeignKey(t => t.UserId)
				.OnDelete(DeleteBehavior.Cascade);
			modelBuilder.Entity<TaskItem>()
				.Property(t => t.TagsJson)
				.HasColumnType("text");
		}

	}
}
