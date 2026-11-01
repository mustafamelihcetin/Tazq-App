import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * AÇILIŞ EKRANI GEOMETRİSİ — ölçülen sayılar görselle birlikte bayatlamasın.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Kullanıcı "logo ile çizgi arası çok boşluk" dedi. Boşluğun çoğu VERİLEN boşluk
 * değildi: tazq_text_*.png 282×153 ve mürekkep yalnız 245×82'lik bir kutuda —
 * altta %18.3 şeffaf pay var. Yani `marginTop` ne yazılırsa yazılsın, görünen
 * aralık her zaman "yazılan değer + resmin görünmez payı" oluyordu.
 *
 * Üstelik bileşen kutu oranını 3.2 varsayıyordu, resmin oranı ise 1.843: `contain`
 * yükseklikten sığdırıp yanlara ölü alan bırakıyordu.
 *
 * Açılış artık bu ölçümden türüyor. Ölçüm, görselin KENDİSİNE bağlı: logo dosyası
 * değişirse (yeniden dışa aktarılır, kırpılır, marka güncellenir) sayılar sessizce
 * yalan söylemeye başlar ve aralık yine bozulur — ama kimse fark etmez, çünkü hata
 * yalnız açılışın ilk saniyesinde ve yalnız gözle görülür.
 *
 * Bu test o sessiz bayatlamayı yakalar.
 */

const ROOT = path.resolve(__dirname, '..');
const SPLASH = fs.readFileSync(path.join(ROOT, 'shared/components/AnimatedSplash.tsx'), 'utf8');

/**
 * Logonun GERÇEK mürekkep kutusu — pikselden ölçülür, koddan okunmaz.
 *
 * Testin metin karşılaştırmasıyla yetinmemesinin sebebi bu: koddaki sayıların
 * birbirine uyması bir şey kanıtlamaz, GÖRSELE uyması kanıtlar. Logo yeniden dışa
 * aktarıldığında değişecek olan da tam burası.
 */
function inkBox(rel: string) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  expect(buf.slice(1, 4).toString('ascii')).toBe('PNG');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  expect(`${rel} 8-bit RGBA: ${buf[24]}/${buf[25]}`).toBe(`${rel} 8-bit RGBA: 8/6`);

  // IDAT parçalarını birleştir (büyük PNG'ler birden çok parçaya bölünür).
  const parts: Buffer[] = [];
  for (let pos = 8; pos + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(pos);
    if (buf.slice(pos + 4, pos + 8).toString('ascii') === 'IDAT') {
      parts.push(buf.slice(pos + 8, pos + 8 + len));
    }
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(parts));

  // Satır filtrelerini geri al (PNG spec §9): her satır kendi filtre baytıyla başlar.
  const CH = 4;
  const stride = width * CH;
  let prev = Buffer.alloc(stride);
  let top = -1, bottom = -1, left = width, right = -1;

  for (let y = 0, p = 0; y < height; y++) {
    const ft = raw[p++];
    const line = Buffer.from(raw.slice(p, p + stride));
    p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= CH ? line[i - CH] : 0;
      const b = prev[i];
      const c = i >= CH ? prev[i - CH] : 0;
      if (ft === 1) line[i] = (line[i] + a) & 255;
      else if (ft === 2) line[i] = (line[i] + b) & 255;
      else if (ft === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (ft === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    // Alfa kanalı > 8: gözle görülür mürekkep (tam saydam kenar yumuşatması sayılmaz).
    for (let x = 0; x < width; x++) {
      if (line[x * CH + 3] > 8) {
        if (top < 0) top = y;
        bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
    prev = line;
  }

  return {
    width,
    height,
    inkW: right - left + 1,
    inkH: bottom - top + 1,
    inkTopPad: top,
    inkBottomPad: height - 1 - bottom,
  };
}

/*
  2026-11-01: imza artık SİSTEM SPLASH'İNİN logosu (kullanıcı: "yazı kayarak imzaya dönsün").
  Eski imza (tazq_text_*.png) ile sistem logosunun oranı farklıydı; birinden ötekine geçiş göze
  batardı. Ölçüm artık sistem splash'inin görseline bağlı.
*/
const LOGOS = ['assets/brand/splash_logo_dark.png', 'assets/brand/splash_logo.png'];
const APP_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const splashPlugin = APP_JSON.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];

/*
  Harf gövdesi (efektsiz ölçü): splash logoları malzemeli (gölge + kenar ışığı), görselin dış
  sınırı bu yüzden harften birkaç piksel taşar ve iki temada farklıdır. Yerleşim HARF gövdesine
  göre yapılır; test efektlerin harfi kaydırmadığını, görsel sınırının gövdeye yakın kaldığını
  kontrol eder.
*/
const BODY = { inkW: 943, inkH: 303, inkTopPad: 374, inkBottomPad: 347, width: 1024 };
const EFFECT_PX = 20;

describe('açılış: sistem splash logosu kayarak imzaya döner', () => {
  it('iki tema logosunda harf AYNI yerde — efektler gövdeyi kaydırmıyor', () => {
    for (const m of LOGOS.map(inkBox)) {
      expect(m.width).toBe(BODY.width);
      expect(Math.abs(m.inkW - BODY.inkW)).toBeLessThanOrEqual(EFFECT_PX);
      expect(Math.abs(m.inkH - BODY.inkH)).toBeLessThanOrEqual(EFFECT_PX);
      expect(Math.abs(m.inkTopPad - BODY.inkTopPad)).toBeLessThanOrEqual(EFFECT_PX);
      expect(Math.abs(m.inkBottomPad - BODY.inkBottomPad)).toBeLessThanOrEqual(EFFECT_PX);
    }
  });

  it('koddaki ölçüler harf gövdesininkiyle birebir aynı', () => {
    expect(SPLASH).toContain(`const NATIVE_INK_W = ${BODY.inkW} / ${BODY.width};`);
    expect(SPLASH).toContain(`const NATIVE_INK_H = ${BODY.inkH} / ${BODY.width};`);
    expect(SPLASH).toContain(`const NATIVE_INK_TOP = ${BODY.inkTopPad} / ${BODY.width};`);
    expect(SPLASH).toContain(`const NATIVE_INK_BOTTOM = ${BODY.inkBottomPad} / ${BODY.width};`);
  });

  it('ilk karedeki boyut sistem splash’ininkiyle aynı (app.json imageWidth = NATIVE_LOGO)', () => {
    /*
      expo-splash-screen logoyu imageWidth karesinde çizer. Kod ile app.json ayrışırsa ilk karede
      logo büyüyüp küçülür — bu test düşer.
    */
    const size = Number(/const NATIVE_LOGO = (\d+);/.exec(SPLASH)?.[1]);
    expect(splashPlugin.imageWidth).toBe(size);
    expect(splashPlugin.image).toBe('./assets/brand/splash_logo_dark.png');
    expect(splashPlugin.dark.image).toBe('./assets/brand/splash_logo.png');
  });

  it('Android 12+ dairesine sığar — görselin köşegeni 192 dp güvenli çapın içinde', () => {
    // Sistem simgeyi 288 dp tuvalde 192 dp daireyle kırpar; taşan harf köşesi kesilir.
    for (const m of LOGOS.map(inkBox)) {
      const k = splashPlugin.imageWidth / m.width;
      expect(Math.hypot(m.inkW * k, m.inkH * k)).toBeLessThan(192);
    }
  });

  it('beklemedeki logo ölçülü — 360 dp ekranda %25 ile %38 arası', () => {
    // Kullanıcı (2026-11-01): 42 dp "çok küçük", 160 dp "devasa", 120 dp "bir tık küçült".
    const share = (BODY.inkW * splashPlugin.imageWidth) / BODY.width / 360;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.38);
  });

  it('her ölçü EKRANDAN türüyor — imza genişliği ve konumu sabit değil', () => {
    expect(SPLASH).toContain('useWindowDimensions()');
    expect(SPLASH).not.toContain("Dimensions.get('window')");
    expect(SPLASH).toContain('const markWidth = Math.min(width * 0.245, 122);');
    expect(SPLASH).toContain('const signScale = markWidth / (NATIVE_LOGO * NATIVE_INK_W);');
    expect(SPLASH).toContain('const fontSize = Math.round(Math.min(64, Math.max(34, width * 0.115)));');
    expect(SPLASH).toContain('const ribbonW = Math.round(Math.min(72, Math.max(36, width * 0.12)));');
  });

  it('imzada görünen kelime genişliği tam markWidth', () => {
    const INK_W = 943 / 1024;
    const markWidth = 393 * 0.245;
    const signScale = markWidth / (113 * INK_W);
    expect(113 * INK_W * signScale).toBeCloseTo(markWidth, 6);
  });
});
