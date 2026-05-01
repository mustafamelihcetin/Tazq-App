using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
    [Route("api/ai")]
    [ApiController]
    [Authorize]
    public class AiController : ControllerBase
    {
        private readonly IGroqService _groq;

        public AiController(IGroqService groq)
        {
            _groq = groq;
        }

        public class ParseRequest
        {
            public string Text { get; set; } = string.Empty;
        }

        [HttpPost("parse-tasks")]
        public async Task<IActionResult> ParseTasks([FromBody] ParseRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Text))
                return BadRequest("Text is required.");

            try
            {
                var tasks = await _groq.ParseTasksFromTextAsync(req.Text);
                return Ok(tasks);
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(503, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}
