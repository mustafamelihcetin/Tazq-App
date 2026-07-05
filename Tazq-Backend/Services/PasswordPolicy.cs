namespace Tazq_App.Services
{
    // Tüm şifre işlemleri (kayıt / değiştir / sıfırla) için tek merkezi politika.
    public static class PasswordPolicy
    {
        public const int MinLength = 8;

        // Kural: en az 8 karakter + en az bir harf + en az bir rakam.
        public static bool IsStrong(string? pw)
        {
            if (string.IsNullOrEmpty(pw) || pw.Length < MinLength) return false;
            bool hasLetter = false, hasDigit = false;
            foreach (var c in pw)
            {
                if (char.IsLetter(c)) hasLetter = true;
                else if (char.IsDigit(c)) hasDigit = true;
                if (hasLetter && hasDigit) return true;
            }
            return hasLetter && hasDigit;
        }

        public const string RequirementTr = "Şifre en az 8 karakter olmalı ve en az bir harf ile bir rakam içermelidir.";
    }
}
