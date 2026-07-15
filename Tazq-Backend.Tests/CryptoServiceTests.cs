using System.Text;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    public class CryptoServiceTests
    {
        private readonly CryptoService _cryptoService;

        public CryptoServiceTests()
        {
            _cryptoService = new CryptoService("test-secret-key-1234567890123456");
        }

        [Fact]
        public void Encrypt_Decrypt_RoundTrip()
        {
            // Arrange
            var originalText = "Yarın saat 15:00'te toplantı var";
            var key = _cryptoService.GetKeyForUser(1);

            // Act
            var encrypted = _cryptoService.Encrypt(originalText, key);
            var decrypted = _cryptoService.Decrypt(encrypted, key);

            // Assert
            Assert.Equal(originalText, decrypted);
            Assert.NotEqual(originalText, encrypted);
        }

        [Fact]
        public void DifferentUsers_DifferentKeys()
        {
            // Arrange & Act
            var key1 = _cryptoService.GetKeyForUser(1);
            var key2 = _cryptoService.GetKeyForUser(2);

            // Assert
            Assert.NotEqual(key1, key2);
        }

        [Fact]
        public void WrongKey_ThrowsException()
        {
            // Arrange
            var key1 = _cryptoService.GetKeyForUser(1);
            var key2 = _cryptoService.GetKeyForUser(2);
            var encrypted = _cryptoService.Encrypt("sensitive data", key1);

            // Act & Assert
            Assert.ThrowsAny<Exception>(() => _cryptoService.Decrypt(encrypted, key2));
        }

        [Fact]
        public void EmptyString_HandlesGracefully()
        {
            // Arrange
            var key = _cryptoService.GetKeyForUser(1);

            // Act
            var encrypted = _cryptoService.Encrypt("", key);
            var decrypted = _cryptoService.Decrypt(encrypted, key);

            // Assert
            Assert.Equal("", decrypted);
        }

        [Fact]
        public void SameText_DifferentCiphertext_EachTime()
        {
            // Arrange — AES-GCM uses random IV so same plaintext produces different ciphertext
            var key = _cryptoService.GetKeyForUser(1);
            var text = "Test Data";

            // Act
            var encrypted1 = _cryptoService.Encrypt(text, key);
            var encrypted2 = _cryptoService.Encrypt(text, key);

            // Assert
            Assert.NotEqual(encrypted1, encrypted2); // Different IV each time
            Assert.Equal(text, _cryptoService.Decrypt(encrypted1, key));
            Assert.Equal(text, _cryptoService.Decrypt(encrypted2, key));
        }

        [Fact]
        public void ComputeBlindIndex_ShouldBeDeterministicAndCaseInsensitive()
        {
            // Arrange
            var text1 = "Tazq Task Search";
            var text2 = "tazq task search!";
            var key = _cryptoService.GetKeyForUser(1);

            // Act
            var hash1 = _cryptoService.ComputeBlindIndex(text1, key);
            var hash2 = _cryptoService.ComputeBlindIndex(text2, key);

            // Assert
            Assert.Equal(hash1, hash2); // Deterministic and case insensitive
            Assert.Contains(" ", hash1); // Multiple words produce space-separated list of hashes
        }

        [Fact]
        public void ComputeBlindIndex_ShouldStripTurkishPunctuationAndTokenize()
        {
            // Arrange
            var text = "Bugün Türkçe, ödevimi yapacağız şenlikle!";
            var key = _cryptoService.GetKeyForUser(1);

            // Act
            var hash = _cryptoService.ComputeBlindIndex(text, key);

            // Assert
            // Words: "bugün", "türkçe", "ödevimi", "yapacağız", "şenlikle"
            var singleWordHash = _cryptoService.ComputeBlindIndex("türkçe", key);
            Assert.Contains(singleWordHash, hash);
        }

        [Fact]
        public void ComputeBlindIndex_DifferentUsers_ProducesDifferentHashes()
        {
            // Arrange
            var text = "ExactSameWord";
            var key1 = _cryptoService.GetKeyForUser(1);
            var key2 = _cryptoService.GetKeyForUser(2);

            // Act
            var hash1 = _cryptoService.ComputeBlindIndex(text, key1);
            var hash2 = _cryptoService.ComputeBlindIndex(text, key2);

            // Assert
            Assert.NotEqual(hash1, hash2); // Cross-user security boundary
        }

        // ── Anahtar rotasyonu ────────────────────────────────────────────────
        //
        // GERÇEK HATA: ENCRYPTION_KEY tanımlı olmadığı için şifreleme sessizce JWT
        // anahtarına düşüyordu. JWT (doğru olarak) döndürülebilen bir sırdır — yani
        // rotasyon = veri ölümü. Kullanıcı bunu "⚠️ (çözülemeyen başlık)" olarak gördü.

        private const string OldSecret = "eski-sir-1234567890123456789012";
        private const string NewSecret = "yeni-sir-1234567890123456789012";

        [Fact]
        public void Anahtar_degisince_eski_veri_okunamaz_hale_gelir()
        {
            // Hatanın KENDİSİNİ belgeleyen test: rotasyon desteği olmasaydı olan buydu.
            var eski = new CryptoService(OldSecret);
            var sifreli = eski.Encrypt("Sunumu bitir", eski.GetKeyForUser(7));

            var yeni = new CryptoService(NewSecret);
            Assert.ThrowsAny<Exception>(() => yeni.Decrypt(sifreli, yeni.GetKeyForUser(7)));
        }

        [Fact]
        public void Eski_sir_tanimliysa_veri_KURTARILIR()
        {
            var eski = new CryptoService(OldSecret);
            var sifreli = eski.Encrypt("Sunumu bitir", eski.GetKeyForUser(7));

            // Yeni sırla çalışan servis, eski sırrı da tanıyor.
            var yeni = new CryptoService(NewSecret, new[] { OldSecret });
            var legacy = yeni.GetLegacyKeysForUser(7);

            Assert.Single(legacy);
            Assert.Equal("Sunumu bitir", yeni.Decrypt(sifreli, legacy[0]));
        }

        [Fact]
        public void Eski_anahtar_sifreleme_icin_KULLANILMAZ()
        {
            // Yeni veri HER ZAMAN geçerli anahtarla yazılmalı; yoksa borç büyür.
            var svc = new CryptoService(NewSecret, new[] { OldSecret });
            var sifreli = svc.Encrypt("yeni görev", svc.GetKeyForUser(7));

            // Geçerli anahtarla okunabiliyor…
            Assert.Equal("yeni görev", svc.Decrypt(sifreli, svc.GetKeyForUser(7)));
            // …eski anahtarla OKUNAMIYOR, yani eskiyle yazılmamış.
            Assert.ThrowsAny<Exception>(() => svc.Decrypt(sifreli, svc.GetLegacyKeysForUser(7)[0]));
        }

        [Fact]
        public void Yanlis_anahtar_SESSIZCE_yanlis_metin_dondurmez()
        {
            // "Anahtarları sırayla dene" yaklaşımının güvenli olmasının SEBEBİ bu:
            // AES-GCM'in doğrulama etiketi yanlış anahtarı yakalar ve exception atar.
            // Etiketsiz bir şifrede (ör. AES-CBC) deneme yapmak çöp düz metin üretirdi.
            var a = new CryptoService(OldSecret);
            var b = new CryptoService(NewSecret);
            var sifreli = a.Encrypt("gizli", a.GetKeyForUser(1));

            Assert.ThrowsAny<Exception>(() => b.Decrypt(sifreli, b.GetKeyForUser(1)));
        }

        [Fact]
        public void Bos_eski_sirlar_elenir()
        {
            // Yapılandırmada "A,,B" ya da "A, B" yazmak sık bir kaza; boş sırdan türetilen
            // anahtar sessizce çöp üretir ve her çözme denemesini yavaşlatır.
            var svc = new CryptoService(NewSecret, new[] { OldSecret, "", "   ", OldSecret });
            Assert.Single(svc.GetLegacyKeysForUser(1));
        }

        [Fact]
        public void Eski_sir_yoksa_liste_bostur()
        {
            Assert.Empty(new CryptoService(NewSecret).GetLegacyKeysForUser(1));
        }

        [Fact]
        public void Anahtar_kullaniciya_ozel_kalir()
        {
            // Rotasyon eklerken bu bozulmamalı: bir kullanıcının anahtarı diğerininkini açmamalı.
            var svc = new CryptoService(NewSecret, new[] { OldSecret });
            var sifreli = svc.Encrypt("özel", svc.GetKeyForUser(1));

            Assert.ThrowsAny<Exception>(() => svc.Decrypt(sifreli, svc.GetKeyForUser(2)));
            Assert.ThrowsAny<Exception>(() => svc.Decrypt(sifreli, svc.GetLegacyKeysForUser(2)[0]));
        }
    }
}
