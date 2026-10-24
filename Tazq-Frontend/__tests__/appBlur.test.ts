import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const SOURCE_DIRS = ['app', 'shared', 'features'];

// Yollar HER ZAMAN eğik çizgiyle: Windows'ta `path.join` ters eğik çizgi üretir ve
// karşılaştırmalar sessizce tutmaz — dosya listede olur ama eşleşmez.
function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return walk(rel);
    return e.name.endsWith('.tsx') || e.name.endsWith('.ts') ? [rel] : [];
  });
}

const FILES = SOURCE_DIRS.flatMap(walk);
const BLUR_HOME = 'shared/components/AppBlur.tsx';

/**
 * BULANIK YÜZEYLER TEK YERDEN.
 *
 * İki ölçülmüş sorun vardı ve ikisi de sessizdi:
 *
 *  1. Android'de HİÇ blur yoktu. `expo-blur`ün Android varsayılanı `blurMethod: 'none'`
 *     ve dokümanı "blur efekti yerine yarı saydam bir view çizer" diyor. 17 çağrının
 *     hepsi Android'de düz örtüydü — iOS'ta bakan biri sorunu göremezdi.
 *  2. 17 çağrıda 12 farklı yoğunluk vardı; tema yönü bile tutarsızdı (bir yerde koyu
 *     tema daha yüksek, başka yerde daha düşük). Sayı seçmek bir tasarım kararıdır ve
 *     17 yerde ayrı ayrı verilemez.
 */
describe('bulanık yüzey — tek giriş', () => {
  it('expo-blur yalnız AppBlur içinden çağrılır', () => {
    const offenders = FILES.filter(
      (f) => f !== BLUR_HOME && read(f).includes("from 'expo-blur'"),
    );
    expect(offenders).toEqual([]);
  });

  it('hiçbir ekran kendi yoğunluk sayısını yazmaz', () => {
    const offenders = FILES.filter((f) => f !== BLUR_HOME && /<BlurView/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  /**
   * DÜZELTME (2026-10-24): bu blok eskiden `dimezisBlurViewSdk31Plus` istendiğini
   * doğruluyordu ve "Android blur açık" sanıyordu. Ölçüldü: expo-blur 56'da bu yöntem
   * bir `blurTarget` (BlurTargetView) ister, yoksa native taraf 'none'a düşüp uyarı
   * basar. Projede BlurTargetView yok — blur hiç çizilmiyordu. Doğru beklenti artık
   * bunu AÇIKÇA söylemek: 'none' (görüntü aynı, uyarı yok). Bkz. androidParity.test.
   */
  it('Android yöntemi açıkça "none" — BlurTargetView kurulmadan blur vaat edilmez', () => {
    const src = read(BLUR_HOME);
    expect(src).toContain('blurMethod="none"');
  });

  it('malzeme seviyeleri kalınlığa göre SIRALI — thin < regular < thick', () => {
    const src = read(BLUR_HOME);
    const level = (name: string) => {
      const m = src.match(new RegExp(`${name}: \\{ light: (\\d+), dark: (\\d+) \\}`));
      return { light: Number(m?.[1]), dark: Number(m?.[2]) };
    };
    const thin = level('thin');
    const regular = level('regular');
    const thick = level('thick');
    for (const mode of ['light', 'dark'] as const) {
      expect(thin[mode]).toBeLessThan(regular[mode]);
      expect(regular[mode]).toBeLessThan(thick[mode]);
    }
  });

  it('chrome değerleri birleştirmede DEĞİŞMEDİ — başlık ve sekme çubuğu aynı kalsın', () => {
    const src = read(BLUR_HOME);
    expect(src).toMatch(/chrome: \{ light: 90, dark: 70 \}/);
  });
});
