import fs from 'fs';
import path from 'path';

/**
 * TUR ÖNİZLEMELERİ — her adım, ANLATTIĞI ekranı çizmeli.
 *
 * ── KULLANICININ BİLDİRDİĞİ KUSUR ─────────────────────────────────────────────
 * Modlar sayfasında bilgi düğmesine basan kullanıcı, turun ilk adımında "Haftalık
 * Merkez" başlığını gördü ve haklı olarak "yanlış sayfanın tanıtımı geldi" dedi.
 * Tur sistemi doğru çalışıyordu: doğru sayfa, doğru adım verisi, doğru kart. YANLIŞ
 * olan tek şey önizlemenin içine yazılmış BAŞLIK metniydi — başka bir ekranın adı.
 *
 * Bu kusurun iki özelliği onu testlik yapıyor:
 *  1. Derleyici görmez — geçerli bir dize, doğru yerde.
 *  2. Kodu okuyan da kolay kolay görmez; ancak o sayfada o düğmeye basan görür.
 *     Nitekim önce turun KAPILARI arandı (odak, blur, gate) ve orada bir şey yoktu;
 *     kusur bir metindeydi.
 *
 * Kural: bir sayfanın önizleme bloğu, BAŞKA bir sayfanın adını içeremez.
 */

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'features/onboarding/components/TourFeaturePreview.tsx'),
  'utf8',
);
/** Yorumları eler — kuralı ANLATAN not, kuralın ihlali sayılmasın. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .join('\n');

/** Ekranların KENDİ adları — uygulamada başlık çubuğunda yazan metin. */
const SCREEN_NAMES: Record<string, string[]> = {
  dashboard: [],                                   // ana ekranın başlığı yok (selamlama)
  tasks: ['Aksiyon Merkezi', 'Action Center'],
  focus: ['Derin Odak', 'Deep Focus'],
  modlar: ['Yaşam Modları', 'Life Modes'],
  cockpit: ['Haftalık Merkez', 'Weekly Hub'],
};

const PAGES = Object.keys(SCREEN_NAMES);

/** `case 'page-n':` sınırlarına göre switch'i bloklara ayırır. */
function blocks(): { page: string; step: number; body: string }[] {
  const marks = [...CODE.matchAll(/case '(\w+)-(\d+)':/g)];
  return marks.map((m, i) => ({
    page: m[1],
    step: Number(m[2]),
    body: CODE.slice(m.index!, i + 1 < marks.length ? marks[i + 1].index! : CODE.length),
  }));
}

describe('tur önizlemesi doğru ekranı çiziyor', () => {
  it('hiçbir önizleme BAŞKA bir ekranın adını yazmıyor', () => {
    const offenders: string[] = [];
    for (const { page, step, body } of blocks()) {
      for (const other of PAGES) {
        if (other === page) continue;
        for (const name of SCREEN_NAMES[other]) {
          if (body.includes(`'${name}'`)) offenders.push(`${page}-${step} → "${name}" (${other} ekranı)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('turdaki HER adımın bir önizlemesi var — boş kutu kalmıyor', () => {
    /*
      Adım eklenip önizlemesi yazılmazsa switch `default`a düşer ve kullanıcı adımın
      yanında boş bir çerçeve görür. Adım sayısının kaynağı turun kendisi.
    */
    const tours = fs.readFileSync(
      path.resolve(__dirname, '..', 'features/onboarding/components/HelpTourModal.tsx'),
      'utf8',
    );
    const drawn = new Set(blocks().map((b) => `${b.page}-${b.step}`));
    const missing: string[] = [];

    for (const page of PAGES) {
      const start = tours.indexOf(`  ${page}: [`);
      expect(`${page} turu tanımlı: ${start >= 0}`).toBe(`${page} turu tanımlı: true`);
      const end = tours.indexOf('\n  ],', start);
      const stepCount = [...tours.slice(start, end).matchAll(/\n      title: \{/g)].length;
      expect(`${page} adım sayısı > 0: ${stepCount > 0}`).toBe(`${page} adım sayısı > 0: true`);
      for (let i = 0; i < stepCount; i++) {
        if (!drawn.has(`${page}-${i}`)) missing.push(`${page}-${i}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
