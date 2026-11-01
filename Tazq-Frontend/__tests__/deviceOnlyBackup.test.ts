import fs from 'fs';
import path from 'path';
import { DEVICE_ONLY_COPY } from '@/features/modes/components/deviceOnlyCopy';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

/**
 * "YEDEK AL" KULLANICIYI YOLDA BIRAKMAZ (2026-10-31, kullanıcı cihazda buldu).
 *
 * Cihazda kalan veri notundaki "Yedek al" Ayarlar'ın en üstünü açıyordu: hangi satır,
 * nerede, ne yapılacak — hiçbiri söylenmiyordu. Kullanıcı Ayarlar'da kayboluyordu.
 * Artık düğme yedeği ORADA başlatır: biçim sorusu → dışa aktarma → paylaşım sayfası.
 * Ayarlar'daki "Verilerimi indir" ile AYNI akış (tek kod, iki kapı).
 */
describe('cihazda kalan veri → yedek', () => {
  const NOTE = read('features/modes/components/DeviceOnlyNote.tsx');
  const SETTINGS = read('app/settings.tsx');

  it("Yedek al Ayarlar'a göndermez, yedeği başlatır", () => {
    expect(NOTE).not.toContain("router.push('/settings')");
    expect(NOTE).toContain('startDataExport(');
  });

  it('Ayarlar ile not aynı akışı kullanır', () => {
    expect(SETTINGS).toContain('startDataExport(');
    expect(SETTINGS).not.toContain("require('@/shared/utils/dataExport')");
  });

  it('metin artık "Ayarlar → …" yolu tarif etmiyor', () => {
    for (const lang of ['tr', 'en'] as const) {
      const c = DEVICE_ONLY_COPY[lang];
      expect(c.healthBody).not.toMatch(/Ayarlar →|Settings →/);
      expect(c.budgetBody).not.toMatch(/Ayarlar →|Settings →/);
    }
  });
});
