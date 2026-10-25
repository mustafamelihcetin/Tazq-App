import fs from 'fs';
import path from 'path';
import { DEVICE_ONLY_COPY } from '@/features/modes/components/deviceOnlyCopy';

/**
 * CİHAZDA KALAN VERİ (2026-10-25, kullanıcı kararı): kilo ve bırakma (özel nitelikli sağlık
 * verisi) ile bütçe (finansal) sunucuya GÖNDERİLMEZ. Kullanıcı bunu çıkış anında değil,
 * veriyi GİRERKEN öğrenmeli — ilgili kartın dibinde sakin bir satır, dokununca gerekçe.
 */
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('DeviceOnlyNote', () => {
  it('üç kart da notu taşır', () => {
    expect(read('features/modes/components/modes/BirakmaCard.tsx')).toContain('<DeviceOnlyNote kind="health"');
    expect(read('features/modes/components/modes/SporCard.tsx')).toContain('<DeviceOnlyNote kind="health"');
    expect(read('features/modes/components/modes/TasarrufCard.tsx')).toContain('<DeviceOnlyNote kind="budget"');
  });

  it('açıklama dürüst: neden, ne zaman silinir, nasıl yedeklenir', () => {
    for (const lang of ['tr', 'en'] as const) {
      const c = DEVICE_ONLY_COPY[lang];
      for (const body of [c.healthBody, c.budgetBody]) {
        expect(body).toMatch(lang === 'tr' ? /sunucu/ : /server/);
        expect(body).toMatch(lang === 'tr' ? /Çıkış/ : /sign out/i);
      }
      expect(c.backup.length).toBeGreaterThan(0);
    }
  });
});
