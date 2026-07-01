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
    }
}
