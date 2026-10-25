import { readGoogleResponse, isGoogleCancel } from '@/features/user/utils/googleResponse';

/**
 * GOOGLE GİRİŞİ — @react-native-google-signin v13+ İPTALDE HATA FIRLATMIYOR (2026-10-25,
 * cihazda görüldü): hesap seçici geri tuşuyla kapatılınca `signIn()` `{ type: 'cancelled',
 * data: null }` döndürüyor. Kod idToken'ı bulamayıp "Google ID Token was not returned"
 * fırlatıyor ve vazgeçen kullanıcıya "Google ile giriş başarısız oldu" gösteriyordu.
 */
describe('readGoogleResponse', () => {
  it('başarı: idToken döner', () => {
    expect(readGoogleResponse({ type: 'success', data: { idToken: 'abc' } })).toEqual({ kind: 'token', idToken: 'abc' });
  });

  it('v13+ iptal yanıtı İPTALDİR, hata değil', () => {
    expect(readGoogleResponse({ type: 'cancelled', data: null })).toEqual({ kind: 'cancelled' });
  });

  it('eski sürüm biçimi (üst düzey idToken) de okunur', () => {
    expect(readGoogleResponse({ idToken: 'old' })).toEqual({ kind: 'token', idToken: 'old' });
  });

  it('başarı ama idToken yok → hata (webClientId eksik/yanlış yapılandırma)', () => {
    expect(() => readGoogleResponse({ type: 'success', data: { idToken: null } })).toThrow(/ID Token/);
  });
});

describe('isGoogleCancel', () => {
  it.each([
    [{ code: 'SIGN_IN_CANCELLED' }, true],
    [{ code: '12501' }, true],
    [new Error('Sign in cancelled'), true],
    [{ code: '10' }, false],
    [new Error('network'), false],
  ])('%p → %p', (err, expected) => {
    expect(isGoogleCancel(err)).toBe(expected);
  });
});
