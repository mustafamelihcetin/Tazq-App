/**
 * Yakalanan hataları tip-güvenli okuma yardımcıları.
 *
 * Neden: `catch (e: any)` yazmak, `e.response.data` gibi zincirlere serbestçe
 * erişmeye izin veriyordu. TypeScript bir catch parametresinin gerçekte ne olduğunu
 * bilemez — JS'te her şey fırlatılabilir (string, null, Error, Axios hatası).
 * `any` ile bu erişimler derlemede sessiz kalıyor, çalışma anında patlıyordu.
 *
 * Doğru yaklaşım catch'i `unknown` yapıp okumayı buradaki dar kapılardan geçirmek.
 */

/** Axios benzeri HTTP hatasının ilgilendiğimiz kısmı. */
export type HttpErrorShape = {
  response?: {
    status?: number;
    data?: unknown;
  };
  code?: string;
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Hatayı HTTP hatası gibi okur. Ağ hatasında `response` undefined kalır. */
export function asHttpError(e: unknown): HttpErrorShape {
  if (!isRecord(e)) return {};
  const out: HttpErrorShape = {};

  const response = e.response;
  if (isRecord(response)) {
    out.response = {
      status: typeof response.status === 'number' ? response.status : undefined,
      data: response.data,
    };
  }
  if (typeof e.code === 'string') out.code = e.code;
  if (typeof e.message === 'string') out.message = e.message;
  return out;
}

/** HTTP durum kodu; ağ hatası / HTTP dışı hata ise undefined. */
export function httpStatusOf(e: unknown): number | undefined {
  return asHttpError(e).response?.status;
}

/** Yanıt gövdesini beklenen alanlarla okur (gövde nesne değilse boş nesne). */
export function httpDataOf<T = Record<string, unknown>>(e: unknown): Partial<T> {
  const data = asHttpError(e).response?.data;
  return isRecord(data) ? (data as Partial<T>) : {};
}

/**
 * Yanıt gövdesini ham hâliyle döndürür.
 * Bazı uçlar JSON yerine düz metin döner (eski sürüm yanıtları); çağıran hem nesne
 * hem string durumunu ele almak zorundaysa httpDataOf değil bunu kullanmalı —
 * httpDataOf string gövdeyi {} yapar ve metin tabanlı kontroller sessizce bozulur.
 */
export function httpRawDataOf(e: unknown): unknown {
  return asHttpError(e).response?.data;
}

/** Ağ katmanına hiç ulaşamadıysak true (sunucu yanıt vermedi). */
export function isNetworkError(e: unknown): boolean {
  return asHttpError(e).response === undefined;
}

/** Loglanabilir mesaj. Error olmayan değerler de güvenle string'e çevrilir. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  const m = asHttpError(e).message;
  return m ?? String(e);
}

/** Hata kodu (ör. Google Sign-In 'SIGN_IN_CANCELLED'). */
export function errorCode(e: unknown): string | undefined {
  return asHttpError(e).code;
}
