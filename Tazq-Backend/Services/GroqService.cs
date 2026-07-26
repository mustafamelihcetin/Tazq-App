using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Polly;
using Polly.Retry;

namespace Tazq_App.Services
{
    public class GroqService : IGroqService
    {
        private readonly HttpClient _http;
        private readonly string? _apiKey;
        private readonly string _model;
        private readonly string _today;
        private readonly AsyncRetryPolicy _retryPolicy;

        /// <summary>
        /// Varsayilan model. AYARLANABILIR olmasinin sebebi somut: kodda
        /// "llama-3.1-8b-instant" sabit yaziliydi ve o model Groq'un model
        /// listesinden kalkti — yani kod, var olmayan bir modele istek atiyordu.
        /// Saglayicilarin model listeleri duzenli degisiyor; bunu koda gomerseniz
        /// her degisiklik bir DERLEME + DAGITIM gerektirir. Env degiskeni olarak
        /// tek satirlik ayar degisikligine iner.
        /// Guncel listeyi Groq konsolundaki "Models" sayfasindan dogrulayin.
        /// </summary>
        private const string DefaultModel = "llama-3.3-70b-versatile";

        public GroqService(IHttpClientFactory httpFactory)
        {
            _http = httpFactory.CreateClient();
            _apiKey = Environment.GetEnvironmentVariable("GROQ_API_KEY");
            var configured = Environment.GetEnvironmentVariable("GROQ_MODEL");
            _model = string.IsNullOrWhiteSpace(configured) ? DefaultModel : configured.Trim();
            _today = DateTime.UtcNow.ToString("yyyy-MM-dd");

            // Create a Polly retry policy: Retry up to 2 times (3 attempts total) on exceptions
            _retryPolicy = Policy
                .Handle<Exception>()
                .WaitAndRetryAsync(2, retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)));
        }

        public async Task<List<ParsedTask>> ParseTasksFromTextAsync(string userText)
        {
            if (string.IsNullOrWhiteSpace(_apiKey))
                throw new InvalidOperationException("GROQ_API_KEY is not configured.");

            var systemPrompt = $$"""
                You are a task extraction assistant. Today is {{_today}}.
                Parse the user's text and extract individual tasks as a JSON array.
                Each task must have: title, description, priority (Low/Medium/High), dueDate (ISO date or null), tags (string array).
                Return ONLY a valid JSON array, no markdown, no explanation.
                Example: [{"title":"Buy groceries","description":"","priority":"Medium","dueDate":null,"tags":["personal"]}]
                """;

            var body = new
            {
                model = _model,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userText }
                },
                temperature = 0.3,
                max_tokens = 1024
            };

            return await _retryPolicy.ExecuteAsync(async () =>
            {
                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
                request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

                var response = await _http.SendAsync(request);
                var raw = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                    throw new Exception($"Groq API error: {raw}");

                using var doc = JsonDocument.Parse(raw);
                var content = doc.RootElement
                    .GetProperty("choices")[0]
                    .GetProperty("message")
                    .GetProperty("content")
                    .GetString() ?? "[]";

                // Strip markdown code blocks if present
                content = content.Trim();
                if (content.StartsWith("```")) content = content.Split('\n', 2)[1];
                if (content.EndsWith("```")) content = content[..^3];

                var tasks = JsonSerializer.Deserialize<List<ParsedTask>>(content.Trim(), new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }) ?? new List<ParsedTask>();

                // Validate and sanitize LLM output
                var validPriorities = new[] { "Low", "Medium", "High" };
                tasks = tasks
                    .Where(t => !string.IsNullOrWhiteSpace(t.Title))
                    .Select(t =>
                    {
                        t.Title = t.Title.Trim();
                        t.Description = t.Description?.Trim() ?? string.Empty;
                        if (string.IsNullOrEmpty(t.Priority) || !validPriorities.Contains(t.Priority))
                            t.Priority = "Medium";
                        return t;
                    })
                    .ToList();

                return tasks;
            });
        }

        /// <summary>
        /// Turkce metne sizan Ingilizce kelimeleri yakalar.
        ///
        /// Genel bir "dil tespiti" yapmiyoruz — asiri karmasik ve yanlis-pozitife acik.
        /// Bunun yerine OLCULMUS sizintilar bir denylist'te tutuluyor (ilk testte
        /// "weaker noktalarini", "weak spot" gorulmustu). Prompt bunlari zaten
        /// yasakliyor; burasi prompt tutmadiginda devreye giren ikinci savunma hatti.
        /// Yeni bir sizinti gorulurse listeye eklenir.
        /// </summary>
        private static readonly string[] EnglishLeaks =
        {
            "weak spot", "weaker", "flashcard", "review et", "practice et",
            "study et", "quiz et", "focus et", "improve et", "check et"
        };

        private static bool ContainsEnglishLeak(string tr)
            => EnglishLeaks.Any(w => tr.Contains(w, StringComparison.OrdinalIgnoreCase));

        private static readonly HashSet<string> AllowedKinds = new()
        {
            "exam", "tez", "mulakat", "kilo", "maraton", "guc", "genel", "ramazan"
        };
        /// <summary>
        /// Kabul edilen faz degerleri.
        ///
        /// DIKKAT — bu kume istemcideki `planPoolKeyFor` ile AYNI olmak zorunda.
        /// Ilk surumde yalnizca sinav/tez fazlari (foundation…sprint) yazilmisti; oysa
        /// MULAKAT kendi bantlarini gonderiyor (far/mid/near/eve). Sonuc: aktif bir
        /// mulakat plani olan her kullanicida uc 400 donuyordu ve havuz hic dolmuyordu.
        /// Yeni bir plan turu/fazi eklenirse buraya da eklenmeli.
        /// </summary>
        private static readonly HashSet<string> AllowedPhases = new()
        {
            "",                                                        // spor/ramazan — faza bolunmez
            "foundation", "deepen", "reinforce", "accelerate", "sprint", // sinav / tez
            "far", "mid", "near", "eve"                                 // mulakat bantlari
        };

        public async Task<List<PlanTaskVariant>> GeneratePlanPoolAsync(PlanPoolRequest req)
        {
            if (string.IsNullOrWhiteSpace(_apiKey))
                throw new InvalidOperationException("GROQ_API_KEY is not configured.");

            // Girdi SIKI dogrulanir: bunlar prompt'a giriyor ve serbest metin kabul
            // etmek prompt enjeksiyonuna acik kapi birakirdi. Kind/phase kapali kume;
            // ad ise uzunluk sinirli ve satir sonlarindan arindirilmis.
            var kind = (req.Kind ?? string.Empty).Trim().ToLowerInvariant();
            var phase = (req.Phase ?? string.Empty).Trim().ToLowerInvariant();
            if (!AllowedKinds.Contains(kind)) throw new ArgumentException("Unsupported kind.");
            if (!AllowedPhases.Contains(phase)) throw new ArgumentException("Unsupported phase.");

            var name = (req.Name ?? string.Empty).Replace('\n', ' ').Replace('\r', ' ').Trim();
            if (name.Length > 60) name = name[..60];

            var count = Math.Clamp(req.Count <= 0 ? 12 : req.Count, 4, 24);

            // PROMPT NOTU — ilk surum olculdu ve YETERSIZDI: model {name} yer tutucusunu
            // hic kullanmayip gercek adi gomuyordu (havuz kind+phase ile onbellege
            // alindigi icin ikinci bir sinavda YANLIS ad gorunurdu), gorevler belirsizdi
            // ("sabah calis", "notlarini duzenle") ve Turkce'ye Ingilizce sizryordu.
            // Cozum: kalite cubugunu ORNEKLE gostermek (few-shot) + belirsiz fiilleri
            // acikca yasaklamak. Olasiliksal oldugu icin ayrica asagida DETERMINISTIK
            // filtre var — prompt'a tek basina guvenilmiyor.
            var systemPrompt = $$"""
                You generate daily micro-tasks for a Turkish habit-tracking app.
                Output ONLY a JSON array, no markdown, no prose.
                Each element: {"tr":"...","en":"..."}

                RULES (all mandatory):
                1. The literal token {name} MUST appear in every task, where the goal name
                   belongs. NEVER write the actual goal name.
                2. tr must be NATURAL TURKISH. No English words mixed in.
                3. Each task must be CONCRETE and MEASURABLE: include a number (questions,
                   minutes, pages, cards) or a named artifact (error log, concept map, summary).
                4. BANNED as standalone tasks: "çalış", "gözden geçir", "planla", "düzenle",
                   "hazırlan" without a measurable object.
                5. One action, doable today. Imperative. Max 85 characters.
                6. tr and en must be the SAME task, not different ones.
                7. All items must be genuinely different actions, not rewordings.
                8. No medical, legal or financial advice. No external links.

                QUALITY BAR — match this exact style:
                [{"tr":"{name}: bugünkü konudan 20 soru çöz ve yanlışları işaretle","en":"{name}: solve 20 questions on today's topic and mark mistakes"},
                {"tr":"{name}: dünkü yanlışlarını tekrar et (aralıklı tekrar)","en":"{name}: review yesterday's mistakes (spaced repetition)"},
                {"tr":"{name}: zorlandığın bir alt başlığa 30 dk derin çalışma ayır","en":"{name}: spend 30 min deep work on a tough subtopic"}]
                """;

            var phaseHint = phase switch
            {
                "foundation" => "Early phase: build understanding and coverage, not speed.",
                "deepen" => "Middle phase: practice, spaced repetition, fixing weak spots.",
                "reinforce" => "Consolidation phase: targeted drilling on weak areas.",
                "accelerate" => "Late phase: timed practice and error analysis.",
                "sprint" => "Final phase: no new material, review and simulation only.",
                // Mulakat bantlari — tarihe kalan sureye gore daralan hazirlik.
                "far" => "Weeks away: CV/profile polish and core technical study.",
                "mid" => "Two-three weeks away: STAR stories and likely question prep.",
                "near" => "Days away: mock interviews, recording review, company research.",
                "eve" => "Tomorrow: logistics, outfit, route, and final rehearsal only.",
                _ => "Steady, sustainable daily actions."
            };

            var userPrompt = $"Goal type: {kind}. {phaseHint} " +
                             (string.IsNullOrEmpty(name) ? "" : $"Goal name: \"{name}\". ") +
                             $"Produce exactly {count} distinct tasks.";

            var body = new
            {
                model = _model,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                },
                temperature = 0.8, // cesitlilik istiyoruz — ayristirmanin aksine
                max_tokens = 2048
            };

            return await _retryPolicy.ExecuteAsync(async () =>
            {
                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
                request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

                var response = await _http.SendAsync(request);
                var raw = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode)
                    throw new Exception($"Groq API error: {raw}");

                using var doc = JsonDocument.Parse(raw);
                var content = doc.RootElement
                    .GetProperty("choices")[0]
                    .GetProperty("message")
                    .GetProperty("content")
                    .GetString() ?? "[]";

                content = content.Trim();
                if (content.StartsWith("```")) content = content.Split('\n', 2)[1];
                if (content.EndsWith("```")) content = content[..^3];

                var variants = JsonSerializer.Deserialize<List<PlanTaskVariant>>(content.Trim(), new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }) ?? new List<PlanTaskVariant>();

                // LLM ciktisi ASLA dogrudan guvenilmez. Prompt olasiliksaldir; asagidaki
                // kontroller DETERMINISTIKTIR ve olculmus somut kusurlari eler:
                //   · {name} eksikligi  -> havuz kind+phase ile onbellege alindigi icin
                //     gercek ad gomulu kalirsa IKINCI planda YANLIS ad gorunur (bug).
                //   · Turkce metne sizan Ingilizce kelimeler ("weaker noktalarin").
                // Elenen oge sessizce dusurulur; liste bosalirsa istemci sabit havuzu
                // kullanmaya devam eder, yani kullanici hicbir sey kaybetmez.
                var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var kept = variants
                    .Where(v => !string.IsNullOrWhiteSpace(v.Tr) && !string.IsNullOrWhiteSpace(v.En))
                    .Select(v => new PlanTaskVariant
                    {
                        Tr = v.Tr.Trim().Replace('\n', ' '),
                        En = v.En.Trim().Replace('\n', ' ')
                    })
                    .Where(v => v.Tr.Length <= 120 && v.En.Length <= 120)
                    .Where(v => v.Tr.Contains("{name}") && v.En.Contains("{name}"))
                    .Where(v => !ContainsEnglishLeak(v.Tr))
                    .Where(v => seen.Add(v.Tr))
                    .Take(count)
                    .ToList();

                return kept;
            });
        }
    }
}
