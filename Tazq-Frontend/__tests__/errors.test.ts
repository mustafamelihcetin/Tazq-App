import {
  asHttpError, httpStatusOf, httpDataOf, isNetworkError, errorMessage, errorCode,
} from '@/shared/utils/errors';

describe('errors yardimcilari', () => {
  const axiosLike = {
    response: { status: 403, data: { banned: true, reason: 'spam' } },
    message: 'Request failed with status code 403',
  };

  it('reads status from an axios-like error', () => {
    expect(httpStatusOf(axiosLike)).toBe(403);
  });

  it('reads the response body', () => {
    expect(httpDataOf<{ banned: boolean }>(axiosLike).banned).toBe(true);
  });

  it('flags a network error when there is no response', () => {
    // Sunucu hiç yanıt vermediyse response yoktur — 4xx/5xx'ten farklı ele alınmalı.
    expect(isNetworkError({ message: 'Network Error' })).toBe(true);
    expect(isNetworkError(axiosLike)).toBe(false);
  });

  // JS'te her sey firlatilabilir; hicbir yardimci bunlarda patlamamali.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string', 'bir seyler patladi'],
    ['number', 42],
    ['bos nesne', {}],
    ['dizi', [1, 2]],
  ])('survives a thrown %s', (_label, value) => {
    expect(() => asHttpError(value)).not.toThrow();
    expect(() => httpStatusOf(value)).not.toThrow();
    expect(() => httpDataOf(value)).not.toThrow();
    expect(() => errorMessage(value)).not.toThrow();
    expect(() => isNetworkError(value)).not.toThrow();
    expect(typeof errorMessage(value)).toBe('string');
  });

  it('ignores malformed response shapes', () => {
    // response bir string ise status okunamaz — undefined donmeli, patlamamalı.
    expect(httpStatusOf({ response: 'bozuk' })).toBeUndefined();
    expect(httpStatusOf({ response: { status: 'not-a-number' } })).toBeUndefined();
    expect(httpDataOf({ response: { data: 'düz metin' } })).toEqual({});
  });

  it('extracts a message from Error and non-Error values', () => {
    expect(errorMessage(new Error('patladi'))).toBe('patladi');
    expect(errorMessage('düz string')).toBe('düz string');
    expect(errorMessage(axiosLike)).toBe('Request failed with status code 403');
    expect(errorMessage(null)).toBe('null');
  });

  it('extracts an error code when present', () => {
    expect(errorCode({ code: 'SIGN_IN_CANCELLED' })).toBe('SIGN_IN_CANCELLED');
    expect(errorCode({})).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
  });
});
