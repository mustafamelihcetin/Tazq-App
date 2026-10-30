import { ringOptions, ringStoreValue, hasRing, RING_NONE } from '@/features/user/utils/avatarRings';
import { AccentPalettes, accentOf } from '@/shared/constants/Colors';

/** Profil çerçevesi = vurgu rengi: çerçeve var/yok, rengi her zaman vurgudan. */
describe('profil çerçevesi', () => {
  it('seçenekler "Yok" + vurgu ailesi, o temanın tonuyla', () => {
    const light = ringOptions(false), dark = ringOptions(true);
    expect(light[0].key).toBe('none');
    expect(light.slice(1).map(o => o.key)).toEqual(AccentPalettes.map(a => a.id));
    expect(light[1].color).toBe(AccentPalettes[0].light.primary);
    expect(dark[1].color).toBe(AccentPalettes[0].dark.primary);
    expect(AccentPalettes.length % 6).toBe(0); // 6'lık ızgarada boş hücre kalmaz (Ayarlar + Hoş Geldin)
  });

  it('sunucuya yazılan değer: yok = transparent, renk = vurgunun açık tonu', () => {
    expect(ringStoreValue('none')).toBe(RING_NONE);
    expect(ringStoreValue('sage')).toBe(accentOf('sage').light.primary);
    expect(hasRing(ringStoreValue('rose'))).toBe(true);
  });

});
