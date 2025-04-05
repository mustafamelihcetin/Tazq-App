using System.Security.Cryptography;
using System.Text;

namespace Tazq_App.Services
{
    public class CryptoService
    {
        private readonly string _secretKey;

        public CryptoService(IConfiguration configuration)
        {
            _secretKey = configuration["EncryptionKey"] ?? throw new ArgumentNullException("EncryptionKey");
        }

        // Encrypts plain text using AES-GCM
        public string Encrypt(string plainText, byte[] key)
        {
            byte[] iv = RandomNumberGenerator.GetBytes(12);
            byte[] tag = new byte[16];
            byte[] cipherText = new byte[plainText.Length];

            using var aes = new AesGcm(key);
            aes.Encrypt(iv, Encoding.UTF8.GetBytes(plainText), cipherText, tag);

            byte[] result = new byte[iv.Length + tag.Length + cipherText.Length];
            Buffer.BlockCopy(iv, 0, result, 0, iv.Length);
            Buffer.BlockCopy(tag, 0, result, iv.Length, tag.Length);
            Buffer.BlockCopy(cipherText, 0, result, iv.Length + tag.Length, cipherText.Length);

            return Convert.ToBase64String(result);
        }

        // Decrypts cipher text using AES-GCM
        public string Decrypt(string cipherTextBase64, byte[] key)
        {
            byte[] data = Convert.FromBase64String(cipherTextBase64);
            byte[] iv = new byte[12];
            byte[] tag = new byte[16];
            byte[] cipherText = new byte[data.Length - iv.Length - tag.Length];

            Buffer.BlockCopy(data, 0, iv, 0, iv.Length);
            Buffer.BlockCopy(data, iv.Length, tag, 0, tag.Length);
            Buffer.BlockCopy(data, iv.Length + tag.Length, cipherText, 0, cipherText.Length);

            byte[] plainText = new byte[cipherText.Length];

            using var aes = new AesGcm(key);
            aes.Decrypt(iv, cipherText, tag, plainText);

            return Encoding.UTF8.GetString(plainText);
        }

        // Generates a user-specific AES key using HMAC-SHA256 and a master secret
        public byte[] GetKeyForUser(int userId)
        {
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secretKey));
            return hmac.ComputeHash(Encoding.UTF8.GetBytes($"user:{userId}"));
        }
    }
}