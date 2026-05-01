using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Tazq_App.Models
{
    public class FocusSession
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        public int UserId { get; set; }

        [JsonIgnore]
        public User? User { get; set; }

        public string TaskName { get; set; } = string.Empty;

        public int DurationMinutes { get; set; }

        public DateTime StartedAt { get; set; } = DateTime.UtcNow;

        public bool Completed { get; set; } = true;
    }
}
