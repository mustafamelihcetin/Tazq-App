using System.Security.Cryptography;
using Tazq_App.Models;

namespace Tazq_App.Services
{
    // Parola hash'leme/doğrulamanın tek merkezi. Daha önce bu mantık 5 ayrı yerde
    // (Register, Login, ResetPassword, ChangePassword, admin seed) kopyalanmıştı;
    // iterasyon sayısını yükseltmek her kopyayı ayrı ayrı bulmayı gerektiriyordu.
    public static class PasswordHasher
    {
        // Maliyet sabitleri model katmanında (PasswordHashDefaults) tanımlı — tek doğruluk kaynağı.
        // Değeri ileride artırmak için orayı değiştirmek yeterli: kullanıcılar bir sonraki
        // başarılı girişte sessizce yeni maliyete taşınır (bkz. NeedsRehash).
        public const int CurrentIterations = PasswordHashDefaults.CurrentIterations;
        public const int LegacyIterations = PasswordHashDefaults.LegacyIterations;

        private const int SaltSize = 16;
        private const int HashSize = 32;

        public record HashResult(string Hash, string Salt, int Iterations);

        public static HashResult Hash(string password)
        {
            var salt = RandomNumberGenerator.GetBytes(SaltSize);
            using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, CurrentIterations, HashAlgorithmName.SHA256);
            return new HashResult(
                Convert.ToBase64String(pbkdf2.GetBytes(HashSize)),
                Convert.ToBase64String(salt),
                CurrentIterations);
        }

        // Sabit zamanlı doğrulama: karşılaştırma erken çıkmaz, böylece yanıt süresi
        // doğru byte sayısı hakkında bilgi sızdırmaz.
        public static bool Verify(string password, string storedHashBase64, string storedSaltBase64, int iterations)
        {
            if (string.IsNullOrEmpty(storedHashBase64) || string.IsNullOrEmpty(storedSaltBase64))
                return false;

            byte[] storedHash, salt;
            try
            {
                storedHash = Convert.FromBase64String(storedHashBase64);
                salt = Convert.FromBase64String(storedSaltBase64);
            }
            catch (FormatException)
            {
                return false; // Bozuk kayıt: doğrulanamaz, exception fırlatıp 500 üretmesin.
            }

            if (iterations <= 0) iterations = LegacyIterations;

            using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations, HashAlgorithmName.SHA256);
            var computed = pbkdf2.GetBytes(storedHash.Length);
            return CryptographicOperations.FixedTimeEquals(computed, storedHash);
        }

        // Kayıt eski/zayıf bir maliyetle üretilmişse true. Çağıran, elinde düz parola varken
        // (yalnızca başarılı doğrulamadan hemen sonra) yeniden hash'leyip saklamalıdır.
        public static bool NeedsRehash(int iterations) => iterations < CurrentIterations;
    }
}
