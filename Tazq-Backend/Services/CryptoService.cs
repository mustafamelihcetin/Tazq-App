using System.Security.Cryptography;
using System.Text;

namespace Tazq_App.Services
{
    public class CryptoService
    {
        private readonly string _secretKey;

        public CryptoService(string secretKey)
        {
            _secretKey = secretKey ?? throw new ArgumentNullException(nameof(secretKey), "EncryptionKey is required");
        }

        // Encrypts plain text using AES-GCM
        public string Encrypt(string plainText, byte[] key)
        {
            byte[] iv = RandomNumberGenerator.GetBytes(12);
            byte[] tag = new byte[16];
            byte[] plainBytes = Encoding.UTF8.GetBytes(plainText);
            byte[] cipherBytes = new byte[plainBytes.Length];

#pragma warning disable SYSLIB0053
            using var aes = new AesGcm(key);
#pragma warning restore SYSLIB0053

            aes.Encrypt(iv, plainBytes, cipherBytes, tag);

            // Combine iv + tag + cipherBytes
            byte[] combined = new byte[iv.Length + tag.Length + cipherBytes.Length];
            Buffer.BlockCopy(iv, 0, combined, 0, iv.Length);
            Buffer.BlockCopy(tag, 0, combined, iv.Length, tag.Length);
            Buffer.BlockCopy(cipherBytes, 0, combined, iv.Length + tag.Length, cipherBytes.Length);

            return Convert.ToBase64String(combined);
        }

        // Decrypts cipher text using AES-GCM
        public string Decrypt(string cipherTextBase64, byte[] key)
        {
            byte[] data = Convert.FromBase64String(cipherTextBase64);
            byte[] iv = new byte[12];
            byte[] tag = new byte[16];
            byte[] cipherBytes = new byte[data.Length - iv.Length - tag.Length];

            Buffer.BlockCopy(data, 0, iv, 0, iv.Length);
            Buffer.BlockCopy(data, iv.Length, tag, 0, tag.Length);
            Buffer.BlockCopy(data, iv.Length + tag.Length, cipherBytes, 0, cipherBytes.Length);

            byte[] plainBytes = new byte[cipherBytes.Length];

#pragma warning disable SYSLIB0053
            using var aes = new AesGcm(key);
#pragma warning restore SYSLIB0053

            aes.Decrypt(iv, cipherBytes, tag, plainBytes);

            return Encoding.UTF8.GetString(plainBytes);
        }

        // Generates a user-specific AES key using HMAC-SHA256 and a master secret
        public byte[] GetKeyForUser(int userId)
        {
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secretKey));
            return hmac.ComputeHash(Encoding.UTF8.GetBytes($"user:{userId}"));
        }
    }
}