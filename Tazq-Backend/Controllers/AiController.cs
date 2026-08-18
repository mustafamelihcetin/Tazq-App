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
            /*
              HATA MESAJLARI SABİT — istemci zaten yalnız DURUM KODUNA bakıyor.

              Üç `catch` de `ex.Message` döndürüyordu. En kötüsü sondakiydi: GroqService
              başarısız çağrıda `throw new Exception($"Groq API error: {raw}")` yapıyor,
              yani Groq'un HAM YANIT GÖVDESİ 500'ün içinde istemciye gidiyordu — üçüncü
              taraf bir servisin hata ayrıntısı, kota/hesap bilgisi dahil.

              Davranış değişmiyor: istemci 503'te sessizce koddaki sabit havuza düşüyor
              (bkz. shared/utils/planPoolSync.ts), 400'de isteği bırakıyor. Ayrıntı
              gerektiğinde sunucu logunda duruyor.
            */
            catch (ArgumentException)
            {
                return BadRequest(new { message = "Geçersiz istek." });
            }
            catch (InvalidOperationException)
            {
                return StatusCode(503, new { message = "Servis şu anda kullanılamıyor." });
            }
            /*
              Groq'a ulaşamamak BİZİM hatamız değil — 500 değil 503.

              Ayrım gürültü içindir: 5xx'ler istemcide Sentry'ye "issue" olarak düşüyor
              (bkz. reportApiError). Groq'un kesintisi 500 sayılırsa, bizde hiçbir şey
              bozulmamışken uyarı yağmuru başlar ve gerçek hatalar arasında kaybolur.
              İstemci için sonuç aynı: 5xx görür, sessizce sabit havuza düşer.
            */
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                return StatusCode(503, new { message = "Servis şu anda kullanılamıyor." });
            }
        }

    }
}
