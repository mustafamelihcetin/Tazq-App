namespace Tazq_App.Services
{
    public interface ICryptoService
    {
        string Encrypt(string plainText, byte[] key);
        string Decrypt(string cipherTextBase64, byte[] key);
        byte[] GetKeyForUser(int userId);
    }
}
