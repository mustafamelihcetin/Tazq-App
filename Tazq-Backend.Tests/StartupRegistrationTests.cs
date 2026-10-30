using System.IO;
using System.Text.RegularExpressions;
using Xunit;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// Başlangıç kayıtları — birim testleri servisleri ELLE kurduğu için DI eksikliğini görmez.
    /// 2026-10-30: FxRateService IMemoryCache istiyordu; AddMemoryCache yalnız Redis'siz (yerel)
    /// dalda kayıtlıydı. Canlıda Redis olduğu için kayıt yoktu ve PaymentsController'ın TÜM uçları
    /// 500 verdi. Bu test kaydın KOŞULSUZ yapıldığını (ortama bağlı dalın dışında) doğrular.
    /// </summary>
    public class StartupRegistrationTests
    {
        private static string ProgramSource()
        {
            var dir = Directory.GetCurrentDirectory();
            while (dir != null && !File.Exists(Path.Combine(dir, "Tazq-Backend", "Program.cs")))
                dir = Directory.GetParent(dir)?.FullName;
            Assert.NotNull(dir);
            return File.ReadAllText(Path.Combine(dir!, "Tazq-Backend", "Program.cs"));
        }

        [Fact]
        public void MemoryCache_IsRegisteredUnconditionally_ForFxRateService()
        {
            var src = ProgramSource();
            // Satır başında (girintisiz) = üst düzey; if/else bloğunun içindeki girintili kayıt sayılmaz.
            Assert.Matches(new Regex(@"^builder\.Services\.AddMemoryCache\(\);", RegexOptions.Multiline), src);
            Assert.Contains("new FxRateService(", src);
        }
    }
}
