﻿namespace Tazq_App.Models
{
	public class SmtpSettings
	{
		public string Host { get; set; } = string.Empty;
		public int Port { get; set; } = 587;
		public string Username { get; set; } = string.Empty;
		public string Password { get; set; } = string.Empty;
		public string From { get; set; } = string.Empty;
	}
}
