using System.ComponentModel.DataAnnotations;
using System.Collections.Generic;

namespace Tazq_App.Models
{
	public class EmailRequestDto
	{
		[Required]
		public string EmailType { get; set; } = string.Empty;

		public List<int>? TaskIds { get; set; }
	}
}
