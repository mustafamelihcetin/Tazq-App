using Npgsql;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// Program.cs'te kurulan PostgreSQL bağlantı dizesinin AYRIŞTIRILABİLİR olduğunu doğrular.
    ///
    /// NEDEN AYRI BİR TEST: geçersiz bir anahtar kelime (ör. "Max Pool Size" yerine
    /// "MaxPoolSize") derleme hatası VERMEZ. Hata ancak çalışma anında, ilk bağlantı
    /// denemesinde çıkar — ve Program.cs'teki başlangıç döngüsü veritabanı hatalarını
    /// 10 kez deneyip yutuyor, ardından "veritabanı olmadan başlatılıyor" deyip devam
    /// ediyor. Yani yanlış yazılmış tek bir anahtar, uygulamanın AYAKTA ama tüm API
    /// çağrılarının 500 döndüğü bir sürüme dağıtılmasıyla sonuçlanırdı.
    ///
    /// Dize burada BİREBİR aynı biçimde kuruluyor; Program.cs değiştirilirse bu test de
    /// güncellenmeli — kopyanın amacı, havuz anahtarlarının sürücü tarafından hâlâ
    /// tanındığını her derlemede kanıtlamak.
    /// </summary>
    public class ConnectionStringTests
    {
        [Fact]
        public void PoolingConnectionString_ShouldBeParsableByNpgsql()
        {
            var connectionString =
                "Host=db;Port=5432;Database=tazqdb;Username=u;Password=p;" +
                "SslMode=Prefer;Trust Server Certificate=true;" +
                "Pooling=true;Minimum Pool Size=0;Maximum Pool Size=100;" +
                "Timeout=15;Command Timeout=30;Connection Idle Lifetime=300;";

            // Geçersiz anahtar kelimede ArgumentException fırlatır — testi kırar.
            var builder = new NpgsqlConnectionStringBuilder(connectionString);

            Assert.True(builder.Pooling);
            Assert.Equal(100, builder.MaxPoolSize);
            Assert.Equal(0, builder.MinPoolSize);
            Assert.Equal(15, builder.Timeout);
            Assert.Equal(30, builder.CommandTimeout);
            Assert.Equal(300, builder.ConnectionIdleLifetime);
        }
    }
}
