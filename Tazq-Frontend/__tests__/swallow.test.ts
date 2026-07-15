import { swallow } from '@/shared/utils/swallow';
import { addBreadcrumb, captureError } from '@/shared/utils/sentry';

jest.mock('@/shared/utils/sentry', () => ({
  addBreadcrumb: jest.fn(),
  captureError: jest.fn(),
}));

describe('swallow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('leaves a breadcrumb trail without raising an issue by default', () => {
    swallow('notifications.cancel', new Error('already gone'));

    expect(addBreadcrumb).toHaveBeenCalledWith('notifications.cancel: already gone', 'swallowed');
    // Varsayılan yol alarm üretmemeli — aksi halde gürültü gerçek sinyali gömer.
    expect(captureError).not.toHaveBeenCalled();
  });

  it('raises an issue when the failure is user-visible', () => {
    const err = new Error('bozuk json');
    swallow('prefs.hydrateFromCloud', err, { capture: true });

    expect(captureError).toHaveBeenCalledWith(err, { 'swallow.context': 'prefs.hydrateFromCloud' });
  });

  it('handles non-Error throws', () => {
    swallow('some.context', 'düz string hata');

    expect(addBreadcrumb).toHaveBeenCalledWith('some.context: düz string hata', 'swallowed');
  });

  it('wraps non-Error values before capturing', () => {
    swallow('some.context', 'düz string', { capture: true });

    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { 'swallow.context': 'some.context' });
  });

  it('never throws, even if reporting itself fails', () => {
    (addBreadcrumb as jest.Mock).mockImplementation(() => {
      throw new Error('sentry down');
    });

    // Raporlama çökerse çağıran akış etkilenmemeli.
    expect(() => swallow('ctx', new Error('x'))).not.toThrow();
  });
});
