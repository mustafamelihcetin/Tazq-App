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
    }
}
