using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Tazq_App.Models
{
	public class UserNotificationPreferences
	{
		[Key]
		[DatabaseGenerated(DatabaseGeneratedOption.Identity)]
		public int Id { get; set; }

		[Required]
		public int UserId { get; set; }

		// Ensure User relationship exists
		[ForeignKey("UserId")]
		public User? User { get; set; }

		// Determines whether the user wants to receive a weekly summary email
		[Required]
		public bool ReceiveWeeklySummary { get; set; } = false;

		// Determines how many days before the due date the user wants to receive a reminder email
		[Range(0, 90, ErrorMessage = "Reminder days must be between 0 and 90.")]
		public int ReminderDaysBeforeDue { get; set; } = 2; // Default: 2 days before due date

		// Specifies which day of the week the user wants to receive the weekly summary
		[Required]
		public DayOfWeek WeeklySummaryDay { get; set; } = DayOfWeek.Sunday;
	}
}
