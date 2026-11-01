import fs from 'fs';
import path from 'path';

/**
 * SERİ UYARILARI — "sen" dili ve suçlamayan ton (2026-11-01, cihazda görüldü).
 *
 * "Son 1 gündür aktif değildiniz. 0 kalkanınız yetersiz kaldığı için seriniz sıfırlandı." — uygulamanın
 * geri kalanı "sen" diliyle konuşuyor (bkz. kayıt ekranı kararı) ve Zen ilkesi suçlamaz: ara bir
 * kusur değil, bir olgu. Yeni metin olguyu söyler ve TEK küçük adım önerir.
 */
const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

describe('seri uyarıları', () => {
  const INDEX = read('app/index.tsx');
  const PROFILE = read('app/profile.tsx');

  it('"siz" dili yok', () => {
    for (const w of ['değildiniz', 'seriniz', 'kalkanınız', 'kazanın']) {
      expect(`${w}: ${INDEX.includes(w) || PROFILE.includes(w)}`).toBe(`${w}: false`);
    }
  });

  it('suçlamaz: "inactive"/"yetersiz" yerine ara verdin; sıfırlanınca tek küçük adım', () => {
    expect(INDEX).not.toMatch(/inactive|yetersiz/);
    expect(INDEX).toContain('gün ara verdin');
    expect(INDEX).toContain('Bugün tek bir iş yeter.');
    expect(INDEX).toContain('One thing today is enough.');
  });
});
