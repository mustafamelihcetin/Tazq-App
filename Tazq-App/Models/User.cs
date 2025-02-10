﻿namespace Tazq_App.Models
{
	public class User
	{
		public int Id { get; set; }
		public string Username { get; set; } = string.Empty;
		public string Email { get; set; } = string.Empty;
		public string PasswordHash { get; set; } = string.Empty;
		public List<TaskItem> Tasks { get; set; } = new List<TaskItem>();
	}
}
