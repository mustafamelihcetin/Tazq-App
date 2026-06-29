using System;
using System.ComponentModel.DataAnnotations;

namespace Tazq_App.Models
{
	public class SupportMessage
	{
		[Key]
		public int Id { get; set; }

		public int UserId { get; set; }

		[Required]
		public string UserName { get; set; } = string.Empty;

		[Required]
		public string UserEmail { get; set; } = string.Empty;

		[Required]
		public string Message { get; set; } = string.Empty;

		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

		public bool IsRead { get; set; } = false;
	}
}
