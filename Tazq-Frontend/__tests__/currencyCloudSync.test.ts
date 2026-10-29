/**
 * "$24 girdim, dev sürümde 24 ₺ çıktı."
 *
 * Para birimi yalnız AsyncStorage'daydı; yeni kurulum/ayrı paket tercihi boş görüp
 * dil varsayımına (TR → ₺) düşüyordu. Artık tercih snapshot'ıyla (__currency) taşınır.
 */
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { usePaymentsStore } from '@/features/payments/store/usePaymentsStore';
import { AuthService } from '@/shared/services/api';

jest.spyOn(AuthService, 'updateProfile').mockResolvedValue({} as any);

beforeEach(() => {
  usePaymentsStore.setState({ currency: null });
  (AuthService.updateProfile as jest.Mock).mockClear();
});

describe('para birimi bulut eşitlemesi', () => {
  it('snapshot seçili para birimini taşır', async () => {
    usePaymentsStore.getState().setCurrency('USD');
    await usePrefsStore.getState().syncToCloud();
    const sent = JSON.parse((AuthService.updateProfile as jest.Mock).mock.calls[0][0].preferences);
    expect(sent.__currency).toBe('USD');
  });

  it('boş yerel tercihi buluttan doldurur (yeni cihaz / dev sürüm)', () => {
    usePrefsStore.getState().hydrateFromCloud(JSON.stringify({ __currency: 'USD' }));
    expect(usePaymentsStore.getState().currency).toBe('USD');
  });

  it('yerel seçimi ezmez', () => {
    usePaymentsStore.getState().setCurrency('EUR');
    usePrefsStore.getState().hydrateFromCloud(JSON.stringify({ __currency: 'USD' }));
    expect(usePaymentsStore.getState().currency).toBe('EUR');
  });

  it('geçersiz değeri yok sayar', () => {
    usePrefsStore.getState().hydrateFromCloud(JSON.stringify({ __currency: 'XYZ' }));
    expect(usePaymentsStore.getState().currency).toBeNull();
  });

  it('seçim anında buluta gönderilir', () => {
    usePaymentsStore.getState().setCurrency('USD');
    expect(AuthService.updateProfile).toHaveBeenCalledTimes(1);
  });

  it('buluta hiç gitmemiş yerel seçimi bir kez gönderir', () => {
    usePaymentsStore.setState({ currency: 'USD' }); // düzeltmeden önceki yerel durum
    usePrefsStore.getState().hydrateFromCloud(JSON.stringify({}));
    expect(AuthService.updateProfile).toHaveBeenCalledTimes(1);
  });
});
