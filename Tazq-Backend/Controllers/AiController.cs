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

        /// <summary>
        /// Bir plan fazi icin cesitli gunluk gorev varyantlari (TR+EN).
        /// Istemci sonucu ONBELLEGE ALIR ve gunluk uretimi yine cevrimdisi yapar;
        /// yani bu uc plan+faz basina EN FAZLA BIR KEZ cagrilir.
        /// Anahtar tanimli degilse 503 doner — istemci sessizce sabit havuza duser.
        /// </summary>
        [HttpPost("plan-pool")]
        public async Task<IActionResult> PlanPool([FromBody] PlanPoolRequest req)
        {
            if (req is null || string.IsNullOrWhiteSpace(req.Kind))
                return BadRequest("Kind is required.");

            try
            {
                var pool = await _groq.GeneratePlanPoolAsync(req);
                return Ok(pool);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
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
