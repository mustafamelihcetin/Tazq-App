using System.Security.Cryptography;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    public class PasswordHasherTests
    {
        [Fact]
        public void Hash_ThenVerify_ShouldSucceed()
        {
            var result = PasswordHasher.Hash("dogru-parola1");
            Assert.True(PasswordHasher.Verify("dogru-parola1", result.Hash, result.Salt, result.Iterations));
        }

        [Fact]
        public void Verify_ShouldFail_ForWrongPassword()
        {
            var result = PasswordHasher.Hash("dogru-parola1");
            Assert.False(PasswordHasher.Verify("yanlis-parola1", result.Hash, result.Salt, result.Iterations));
        }

        [Fact]
        public void Hash_ShouldUseCurrentIterations()
        {
            Assert.Equal(PasswordHashDefaults.CurrentIterations, PasswordHasher.Hash("x1abcdefg").Iterations);
        }

        [Fact]
        public void Hash_ShouldProduceUniqueSaltPerCall()
        {
            // Aynı parola iki kez hash'lenince farklı salt → farklı hash (rainbow table direnci).
            var a = PasswordHasher.Hash("ayni-parola1");
            var b = PasswordHasher.Hash("ayni-parola1");
            Assert.NotEqual(a.Salt, b.Salt);
            Assert.NotEqual(a.Hash, b.Hash);
        }

        [Fact]
        public void Verify_ShouldAcceptLegacy100kHash()
        {
            // Bu, PasswordIterations sütunu eklenmeden önce üretilmiş bir kaydı taklit eder.
            // Doğrulanamazsa mevcut tüm kullanıcılar kilitlenir — migration'ın can damarı.
            var salt = RandomNumberGenerator.GetBytes(16);
            using var pbkdf2 = new Rfc2898DeriveBytes("eski-parola1", salt, PasswordHashDefaults.LegacyIterations, HashAlgorithmName.SHA256);
            var legacyHash = Convert.ToBase64String(pbkdf2.GetBytes(32));

            Assert.True(PasswordHasher.Verify("eski-parola1", legacyHash, Convert.ToBase64String(salt), PasswordHashDefaults.LegacyIterations));
        }

        [Fact]
        public void Verify_ShouldTreatMissingIterationsAsLegacy()
        {
            // Savunma: migration atlanır ve sütun 0 kalırsa yine de eski hash'ler doğrulanmalı.
            var salt = RandomNumberGenerator.GetBytes(16);
            using var pbkdf2 = new Rfc2898DeriveBytes("eski-parola1", salt, PasswordHashDefaults.LegacyIterations, HashAlgorithmName.SHA256);
            var legacyHash = Convert.ToBase64String(pbkdf2.GetBytes(32));

            Assert.True(PasswordHasher.Verify("eski-parola1", legacyHash, Convert.ToBase64String(salt), 0));
        }

        [Fact]
        public void NeedsRehash_ShouldBeTrueForLegacy_AndFalseForCurrent()
        {
            Assert.True(PasswordHasher.NeedsRehash(PasswordHashDefaults.LegacyIterations));
            Assert.False(PasswordHasher.NeedsRehash(PasswordHashDefaults.CurrentIterations));
        }

        [Fact]
        public void Verify_ShouldFail_ForMalformedStoredValues()
        {
            // Bozuk kayıt 500 üretmemeli, sadece doğrulamayı reddetmeli.
            Assert.False(PasswordHasher.Verify("parola12", "not-base64!!", "also-not-base64!!", 600_000));
            Assert.False(PasswordHasher.Verify("parola12", "", "", 600_000));
        }
    }
}
