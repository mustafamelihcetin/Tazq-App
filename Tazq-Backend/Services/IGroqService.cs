namespace Tazq_App.Services
{
    public interface IGroqService
    {
        Task<List<ParsedTask>> ParseTasksFromTextAsync(string userText);

        /// <summary>
        /// Bir plan fazı için ÇEŞİTLİ günlük görev varyantları üretir (TR + EN).
        ///
        /// Neden: günlük görev havuzları koda gömülü ve çok küçük (tıp/tez/mülakat
        /// fazlarında yalnız 2 görev). Günde 1 görev üreten bir kullanıcı aynı iki
        /// görevi aylarca dönüşümlü görüyor. Bu uç, havuzu PLAN BAŞINA BİR KEZ
        /// genişletmek için: sonuç istemcide önbelleğe alınır, günlük üretim yine
        /// çevrimdışı ve deterministik kalır.
        /// </summary>
        Task<List<PlanTaskVariant>> GeneratePlanPoolAsync(PlanPoolRequest req);
    }

    public class PlanPoolRequest
    {
        /// exam | tez | mulakat | kilo | maraton | guc | genel | ramazan
        public string Kind { get; set; } = string.Empty;
        /// foundation | deepen | reinforce | accelerate | sprint  (spor/ramazan icin bos)
        public string Phase { get; set; } = string.Empty;
        /// Sinav/tez/sirket adi — istemci {name} yer tutucusuyla degistirir.
        public string? Name { get; set; }
        public int Count { get; set; } = 12;
    }

    public class PlanTaskVariant
    {
        public string Tr { get; set; } = string.Empty;
        public string En { get; set; } = string.Empty;
    }

    public class ParsedTask
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Priority { get; set; } = "Medium";
        public string? DueDate { get; set; }
        public List<string> Tags { get; set; } = new();
    }
}
