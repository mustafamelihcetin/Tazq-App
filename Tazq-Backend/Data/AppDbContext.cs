using Microsoft.EntityFrameworkCore;
using Tazq_App.Models;

namespace Tazq_App.Data
{
	public class AppDbContext : DbContext
	{
		public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

		public DbSet<TaskItem> Tasks { get; set; }
		public DbSet<User> Users { get; set; }
		public DbSet<UserNotificationPreferences> UserNotificationPreferences { get; set; }
		public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }
		public DbSet<FocusSession> FocusSessions { get; set; }
		public DbSet<RefreshToken> RefreshTokens { get; set; }
		public DbSet<ContentDocument> ContentDocuments { get; set; }
		public DbSet<SupportMessage> SupportMessages { get; set; }
		public DbSet<ClientCrash> ClientCrashes { get; set; }


		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			base.OnModelCreating(modelBuilder);

			// Soft-delete: silinmiş (DeletedAt != null) kullanıcılar tüm normal sorgulardan otomatik hariç.
			// Login/register reaktivasyon akışları IgnoreQueryFilters() ile bu filtreyi bilerek atlar.
			modelBuilder.Entity<User>().HasQueryFilter(u => u.DeletedAt == null);

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

			modelBuilder.Entity<FocusSession>()
				.HasOne(f => f.User)
				.WithMany()
				.HasForeignKey(f => f.UserId)
				.OnDelete(DeleteBehavior.Cascade);

			// Explicit indexes for query performance
			modelBuilder.Entity<TaskItem>().HasIndex(t => t.UserId);
			// Idempotency lookup: aynı kullanıcıda ClientKey ile hızlı çift-kayıt kontrolü
			modelBuilder.Entity<TaskItem>().HasIndex(t => new { t.UserId, t.ClientKey });
			modelBuilder.Entity<TaskItem>().HasIndex(t => new { t.UserId, t.TitleBlindIndex });
			modelBuilder.Entity<TaskItem>().HasIndex(t => new { t.UserId, t.TagsBlindIndex });
			modelBuilder.Entity<FocusSession>().HasIndex(f => f.UserId);
			modelBuilder.Entity<FocusSession>().HasIndex(f => f.StartedAt);
			modelBuilder.Entity<PasswordResetToken>().HasIndex(t => t.Token).IsUnique();

			modelBuilder.Entity<RefreshToken>()
				.HasOne(t => t.User)
				.WithMany()
				.HasForeignKey(t => t.UserId)
				.OnDelete(DeleteBehavior.Cascade);
			modelBuilder.Entity<RefreshToken>().HasIndex(t => t.TokenHash).IsUnique();
			modelBuilder.Entity<RefreshToken>().HasIndex(t => t.UserId);

			modelBuilder.Entity<ContentDocument>().HasIndex(c => c.Key).IsUnique();

			modelBuilder.Entity<ClientCrash>().HasIndex(c => c.CreatedAt);
			modelBuilder.Entity<ClientCrash>().HasIndex(c => c.UserId);
		}
	}
}
