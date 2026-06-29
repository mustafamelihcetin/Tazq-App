// Ortak istemci-tarafı doğrulama katmanı.
// Amaç: en çok kullanılan formların (login/register/forgot) doğrulama felsefesini
// modlar ekranındaki zengin doğrulamayla aynı standarda çekmek. Tek kaynak → tutarlı.

// Pragmatik e-posta deseni: RFC'nin tamamını değil, gerçek kullanıcı hatalarını yakalar
// (boşluk, eksik @, eksik alan adı, eksik TLD). Aşırı katı olmaz.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  const e = (email ?? '').trim();
  if (e.length === 0 || e.length > 254) return false;
  return EMAIL_REGEX.test(e);
}

export const PASSWORD_MIN_LENGTH = 6;

export function isValidPassword(password: string): boolean {
  return (password ?? '').length >= PASSWORD_MIN_LENGTH;
}

export type LoginErrorKey = 'empty' | 'invalidEmail' | null;

// Login: boş alan mı, geçersiz e-posta mı ayrımını döndürür (mesaj üretmez — i18n çağırana ait).
export function validateLogin(email: string, password: string): LoginErrorKey {
  if (!email?.trim() || !password) return 'empty';
  if (!isValidEmail(email)) return 'invalidEmail';
  return null;
}

export type RegisterErrorKey = 'empty' | 'invalidEmail' | 'weakPassword' | 'consent' | null;

export function validateRegister(
  name: string,
  email: string,
  password: string,
  consentChecked: boolean,
): RegisterErrorKey {
  if (!name?.trim() || !email?.trim() || !password) return 'empty';
  if (!isValidEmail(email)) return 'invalidEmail';
  if (!isValidPassword(password)) return 'weakPassword';
  if (!consentChecked) return 'consent';
  return null;
}
