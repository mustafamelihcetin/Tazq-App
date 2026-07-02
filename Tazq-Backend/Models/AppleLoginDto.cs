namespace Tazq_App.Models
{
	public class AppleLoginDto
	{
		public string IdentityToken { get; set; } = string.Empty;
		public string? FirstName { get; set; }
		public string? LastName { get; set; }
	}
}
