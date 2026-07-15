namespace Tazq_App.Models
{
    // Parola hash maliyetinin tek doğruluk kaynağı. Model katmanında durur ki
    // User modeli hash'leme servisine bağımlı olmasın (domain → infrastructure sızıntısı).
    // Servis tarafındaki sarmalayıcı: Tazq_App.Services.PasswordHasher.
    public static class PasswordHashDefaults
    {
        // OWASP'ın PBKDF2-SHA256 için güncel önerisi.
        public const int CurrentIterations = 600_000;

        // PasswordIterations sütunu eklenmeden önce yazılan kayıtların maliyeti.
        public const int LegacyIterations = 100_000;
    }
}
