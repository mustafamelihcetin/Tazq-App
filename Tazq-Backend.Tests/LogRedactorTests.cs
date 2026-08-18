using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    /// <summary>
    /// Maskeleyicinin İKİ yönü de test ediliyor: hassas değeri gizlemesi ve teşhis için
    /// gereken bağlamı GİZLEMEMESİ. İkincisi en az birincisi kadar önemli — her şeyi
    /// yıldıza çeviren bir maskeleyici, logu güvenli ama işe yaramaz hale getirir ve
    /// kimse fark etmez.
    /// </summary>
    public class LogRedactorTests
    {
        [Fact]
        public void Redact_ShouldMaskEmailLocalPart_ButKeepDomain()
        {
            var result = LogRedactor.Redact("Doğrulama maili gönderilemedi: melih@tazqapp.com");

            Assert.DoesNotContain("melih@", result);
            Assert.Contains("m***h@tazqapp.com", result);
            // Alan adı korunmalı: hataların tek sağlayıcıda toplandığını görmek için gerekli.
            Assert.Contains("tazqapp.com", result);
        }

        [Fact]
        public void Redact_ShouldFullyMaskShortLocalPart()
        {
            // İki karakterlik yerel kısımda "ilk ve son" göstermek adresi tamamen açığa çıkarır.
            var result = LogRedactor.Redact("mk@ornek.com adresine ulaşılamadı");

            Assert.DoesNotContain("mk@", result);
            Assert.Contains("**@ornek.com", result);
        }

        [Fact]
        public void Redact_ShouldMaskJwt()
        {
            const string jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSJ9.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk";
            var result = LogRedactor.Redact($"Token doğrulanamadı: {jwt}");

            Assert.DoesNotContain("eyJhbGciOiJIUzI1NiI", result);
            Assert.Contains("[jwt]", result);
        }

        [Fact]
        public void Redact_ShouldMaskBearerHeader()
        {
            var result = LogRedactor.Redact("Authorization: Bearer aXNzdWVkLXNlY3JldC12YWx1ZQ==");

            Assert.DoesNotContain("aXNzdWVkLXNlY3JldC12YWx1ZQ", result);
            Assert.Contains("Bearer [gizlendi]", result);
        }

        [Fact]
        public void Redact_ShouldMaskResetTokenInUrl()
        {
            var result = LogRedactor.Redact(
                "GET /api/users/reset-password-form?token=Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5 başarısız");

            Assert.DoesNotContain("Zm9vYmFyYmF6cXV4", result);
            Assert.Contains("[gizlendi]", result);
        }

        [Fact]
        public void Redact_ShouldMaskPasswordInJsonLikeText()
        {
            var result = LogRedactor.Redact("Gövde: {\"email\":\"a@b.com\",\"password\":\"CokGizli123\"}");

            Assert.DoesNotContain("CokGizli123", result);
        }

        [Fact]
        public void Redact_ShouldPreserveOrdinaryDiagnosticText()
        {
            // Regresyon freni: maskeleyici normal bir hata satırına DOKUNMAMALI.
            const string message = "Unhandled exception 0HN7A on POST /api/tasks | user=42 ip=10.0.0.3";
            Assert.Equal(message, LogRedactor.Redact(message));
        }

        [Fact]
        public void Redact_ShouldPreserveTimestampsAndIds()
        {
            // Kredi kartı / kimlik numarası deseni bilerek eklenmedi; uzun sayı dizileri
            // (zaman damgası, kimlik) maskelenmemeli. Bu test o kararı sabitler.
            const string message = "Migration 20260715111227_AddPasswordIterations uygulandı (1734567890123)";
            Assert.Equal(message, LogRedactor.Redact(message));
        }

        [Fact]
        public void Redact_ShouldHandleNullAndEmpty()
        {
            Assert.Equal(string.Empty, LogRedactor.Redact(null));
            Assert.Equal(string.Empty, LogRedactor.Redact(""));
        }
    }
}
