import { errorCode, errorMessage } from '@/shared/utils/errors';

/*
  GOOGLE GİRİŞ YANITI — giriş ve kayıt ekranlarının ORTAK okuması (bkz.
  __tests__/googleResponse.test.ts). İki ekran ayrı ayrı okuyordu ve ikisi de aynı
  hatayı taşıyordu: kütüphane v13'ten beri iptalde hata fırlatmıyor,
  `{ type: 'cancelled' }` döndürüyor — vazgeçen kullanıcı "başarısız oldu" görüyordu.
*/

export type GoogleOutcome = { kind: 'token'; idToken: string } | { kind: 'cancelled' };

type GoogleSignInResponse = {
  type?: string;
  data?: { idToken?: string | null } | null;
  idToken?: string | null;
};

export function readGoogleResponse(response: GoogleSignInResponse | null | undefined): GoogleOutcome {
  if (response?.type === 'cancelled') return { kind: 'cancelled' };
  const idToken = response?.data?.idToken || response?.idToken;
  if (!idToken) throw new Error('Google ID Token was not returned.');
  return { kind: 'token', idToken };
}

/** Eski sürümler / Android iptali hata olarak bildiriyor: kod ya da mesajla tanınır. */
export function isGoogleCancel(err: unknown): boolean {
  const code = errorCode(err);
  return code === 'SIGN_IN_CANCELLED' || code === '12501' || errorMessage(err).includes('Sign in cancelled');
}

/**
 * Geliştirme derlemesinde hata koduyla birlikte göster — "başarısız oldu" tek başına
 * teşhis ettirmiyor (Android '10' = DEVELOPER_ERROR: bu paket + SHA-1 için Google
 * Cloud'da Android OAuth istemcisi yok). Yayında kod gösterilmez.
 */
export function googleFailureSuffix(err: unknown, isDev: boolean): string {
  const code = errorCode(err);
  return isDev && code ? ` (${code})` : '';
}
