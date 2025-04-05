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

            // Encode all parts into one Base64 string
            using var ms = new MemoryStream();
            using var bw = new BinaryWriter(ms);
            bw.Write(iv);
            bw.Write(tag);
            bw.Write(cipherBytes);

            return Convert.ToBase64String(ms.ToArray());
        }

        // Decrypts cipher text using AES-GCM
        public string Decrypt(string cipherTextBase64, byte[] key)
        {
            byte[] fullData = Convert.FromBase64String(cipherTextBase64);

            using var ms = new MemoryStream(fullData);
            using var br = new BinaryReader(ms);

            byte[] iv = br.ReadBytes(12);
            byte[] tag = br.ReadBytes(16);
            byte[] cipherBytes = br.ReadBytes(fullData.Length - 12 - 16);

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