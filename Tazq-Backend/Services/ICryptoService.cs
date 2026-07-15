namespace Tazq_App.Services
{
    public interface ICryptoService
    {
        string Encrypt(string plainText, byte[] key);
        string Decrypt(string cipherTextBase64, byte[] key);

        /// <summary>Şifreleme ve çözme için GEÇERLİ anahtar. Yeni veri hep bununla yazılır.</summary>
        byte[] GetKeyForUser(int userId);

        /// <summary>
        /// ESKİ sırlardan türetilen anahtarlar — yalnızca ÇÖZME için, asla şifreleme için.
        ///
        /// Neden var: şifreleme anahtarı değiştiğinde eski anahtarla yazılmış veri okunamaz
        /// hale gelir ve GERİ GETİRİLEMEZ. Uygulamada bu yaşandı: ENCRYPTION_KEY tanımlı
        /// olmadığı için şifreleme sessizce JWT anahtarına düşüyordu, JWT ise (doğru olarak)
        /// döndürülebilen bir sır. Rotasyon = veri ölümü.
        ///
        /// Bu liste sayesinde eski sırlar tanımlıysa veri okunmaya devam eder. Standart
        /// "key rotation" deseni: yeniyle yaz, eskilerle de oku.
        /// </summary>
        IReadOnlyList<byte[]> GetLegacyKeysForUser(int userId);

        string ComputeBlindIndex(string input, byte[] key);
    }
}
