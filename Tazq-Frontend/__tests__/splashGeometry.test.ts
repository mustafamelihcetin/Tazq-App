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
    inkBottomPad: height - 1 - bottom,
  };
}

const LOGOS = ['assets/images/tazq_text_dark.png', 'assets/images/tazq_text_white.png'];

describe('açılış ekranı kelime işaretine bağlı', () => {
  it('iki logo varyantı AYNI ölçüde — biri değişip öteki kalamaz', () => {
    // Açık ve koyu varyant aynı kutuyu paylaşmalı; ayrışırsa tema değiştirince
    // logo yerinden oynar ve aralık iki temada FARKLI çıkar.
    const [a, b] = LOGOS.map(inkBox);
    expect(a).toEqual(b);
  });

  it('koddaki dört sabit, GÖRSELDEN ölçülenle birebir aynı', () => {
    /*
      Sabitler `282 / 153` gibi ÇİĞ oranlar olarak yazılı (sadeleştirilmiş bir ondalık
      değil) — tam da buradan karşılaştırılabilsinler diye. Sadeleştiren biri testi
      kırar ve nedenini burada okur.
    */
    const m = inkBox(LOGOS[0]);
    expect(SPLASH).toContain(`const LOGO_ASPECT = ${m.width} / ${m.height};`);
    expect(SPLASH).toContain(`const LOGO_INK_W = ${m.inkW} / ${m.width};`);
    expect(SPLASH).toContain(`const LOGO_INK_H = ${m.inkH} / ${m.height};`);
    expect(SPLASH).toContain(`const LOGO_INK_BOTTOM = ${m.inkBottomPad} / ${m.height};`);
  });

  it('görselin ALT PAYI hâlâ göz ardı edilemeyecek kadar büyük', () => {
    /*
      Bütün düzeltmenin dayandığı olgu: resmin altında ciddi bir şeffaf pay var
      (ölçüm: %18.3). Biri logoyu kırpılmış hâliyle değiştirirse bu pay sıfıra iner
      ve ÇIKARMA aralığı olduğundan dar bırakır — yani kusur ters yönden geri gelir.
      O gün bu test düşer ve LOGO_GAP_RATIO'nun yeniden bakılması gerektiğini söyler.
    */
    const m = inkBox(LOGOS[0]);
    expect(m.inkBottomPad / m.height).toBeGreaterThan(0.1);
  });

  it('aralık resmin GÖRÜNMEZ payı çıkarılarak veriliyor', () => {
    /*
      Bu çıkarma olmadan aralık her zaman resmin alt payı kadar fazla çıkar — kusurun
      ta kendisi buydu. `Math.max(0, ...)` da şart: küçük ekranda çıkarma negatife
      dönerse düzen yukarı kayar.
    */
    expect(SPLASH).toMatch(
      /markGap = Math\.max\(0, Math\.round\(inkHeight \* LOGO_GAP_RATIO - boxHeight \* LOGO_INK_BOTTOM\)\)/,
    );
    expect(SPLASH).toContain('marginTop: markGap');
    // Sabit bir jetona (S.md gibi) geri dönülürse resmin payı yine hesaba katılmaz.
    expect(SPLASH).not.toMatch(/marginTop: S\./);
  });

  it('her ölçü EKRANDAN türüyor — hiçbir şey sabit yazılmamış', () => {
    /*
      Açılış tek ölçüden (`width`) türemeli: küçük telefondan yatay tablete kadar
      aynı oran korunsun. `Dimensions.get()` modül yüklenirken donar; döndürmede ve
      bölünmüş ekranda yanlış ölçüde kalır.
    */
    expect(SPLASH).toContain('useWindowDimensions()');
    expect(SPLASH).not.toContain("Dimensions.get('window')");
    expect(SPLASH).toContain('const markWidth = Math.min(width * 0.24, 110);');
    for (const derived of [
      'const boxWidth = markWidth / LOGO_INK_W;',
      'const boxHeight = boxWidth / LOGO_ASPECT;',
      'const lineWidth = Math.round(markWidth);',
    ]) {
      expect(SPLASH).toContain(derived);
    }
  });

  it('kap oranı resmin oranına EŞİT — contain ölü alan bırakmıyor', () => {
    /*
      boxWidth = markWidth / LOGO_INK_W ve boxHeight = boxWidth / LOGO_ASPECT olduğu
      için kabın oranı tam LOGO_ASPECT. Eski hâlde kap 3.2 idi ve `contain` resmi
      yükseklikten sığdırıp yanlarda ~%43 boş alan bırakıyordu; altındaki çizgi de o
      hayalî genişliğe göre hesaplanıyordu.
    */
    const A = 282 / 153, INK_W = 245 / 282;
    const markWidth = 393 * 0.24;
    const boxWidth = markWidth / INK_W;
    const boxHeight = boxWidth / A;
    expect(boxWidth / boxHeight).toBeCloseTo(A, 6);
    // Çizgi tam kelimenin genişliği: iki kenar aynı hizada biter.
    expect(Math.round(markWidth)).toBe(Math.round(boxWidth * INK_W));
  });
});
