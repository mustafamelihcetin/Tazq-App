import fs from 'fs';
import path from 'path';
import { R, ICON, S, F } from '@/shared/constants/tokens';

/**
 * Tasarım sistemi bekçisi.
 *
 * Neden: ölçekler vardı ama kimse zorlamıyordu. Sonuç: 45 farklı elle yazılmış köşe
 * yarıçapı, 22 farklı ikon boyutu, 870 palet dışı renk. Ölçeği "olması" yetmiyor —
 * atlanamaz olması gerekiyor. tsc bunları göremez (hepsi geçerli sayı/string).
 *
 * Bu test yeni ihlalleri engeller. Mevcut istisnalar aşağıda AÇIKÇA listelenir;
 * liste küçülmeli, büyümemeli.
 */

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = ['node_modules', '.expo', 'android', 'ios', '.git', '__tests__', '__mocks__', 'dist'];

/**
 * Ölçek disiplininden MUAF dosyalar — gerekçesiyle.
 *
 * Bu liste bir kaçış kapısı değil, bir sınır tanımı: burada listelenen dosyalar
 * uygulamanın layout'unu çizmiyor, dolayısıyla layout ölçeği onlara uygulanmaz.
 * Liste kısa kalmalı; yeni ekleme yapmadan önce dosyanın gerçekten bu kategoriye
 * girdiğinden emin ol.
 */
const EXEMPT: Record<string, string> = {
  // Pazarlama sayfası: uygulamanın küçültülmüş temsillerini çiziyor ve her ölçüyü
  // ekran genişliğine göre ORANSAL hesaplıyor (`const S = fw / 234`, `8 * S`, `dia / 2`).
  // Sabit token koymak mock'u bozar — burada 12pt "12pt" demek değil, oranın parçası.
  'app/promo.tsx': 'oransal mock çizici — ölçüler ekran genişliğine göre hesaplanır',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');
const FILES = walk(ROOT).filter((f) => !EXEMPT[rel(f)]);

/** Yorum satırlarını atar — kural metinleri kuralın kendisi sanılmasın. */
function stripComments(src: string): string {
  return src
    .split('\n')
    .filter((l) => {
      const s = l.trim();
      return !s.startsWith('//') && !s.startsWith('*') && !s.startsWith('/*');
    })
    .join('\n');
}

/**
 * Blok yorumlarını boşluğa çevirir — satır sayısı korunur.
 * Satır satır tarama yalnızca `//` başlangıcını atlıyordu; bir kuralın NEDENİNİ
 * anlatan JSX blok yorumu (`{/* ... *\/}`) kod sanılıp ihlal sayılıyordu. Yani
 * kuralı açıklamak kuralı çiğnemek oluyordu.
 */
function stripBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function sourcesWithout(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of FILES) {
    const src = stripBlockComments(fs.readFileSync(file, 'utf8'));
    const lines = src.split('\n');
    lines.forEach((line, i) => {
      const s = line.trim();
      if (s.startsWith('//') || s.startsWith('*')) return;
      if (pattern.test(line)) hits.push(`${rel(file)}:${i + 1}`);
    });
  }
  return hits;
}

describe('ölçek tanımları', () => {
  it('köşe yarıçapı iOS bandında olmalı', () => {
    // Apple: gruplanmış hücre ~10, kart ~12-16, sheet ~16-22.
    // R.lg bir ara 24'tü — Apple'ın en yuvarlak kartından yuvarlaktı.
    //
    // Eşikler moderateScale'i hesaba katar: geniş ekranda değer en fazla 1.125 katına
    // çıkar (ölçek oranı MAX_RATIO=1.25 ile sınırlı, faktör 0.5). Yani taban 12 → en
    // fazla 13.5; taban 22 → en fazla 24.75.
    expect(R.md).toBeLessThanOrEqual(12 * 1.125);
    expect(R.lg).toBeLessThanOrEqual(16 * 1.125);
    expect(R.xl).toBeLessThanOrEqual(22 * 1.125);
  });

  it('ölçekler artan sırada ve çakışmasız olmalı', () => {
    expect(R.xs).toBeLessThan(R.sm);
    expect(R.sm).toBeLessThan(R.md);
    expect(R.md).toBeLessThan(R.lg);
    expect(R.lg).toBeLessThan(R.xl);

    expect(ICON.xs).toBeLessThan(ICON.sm);
    expect(ICON.sm).toBeLessThan(ICON.md);
    expect(ICON.md).toBeLessThan(ICON.lg);
    expect(ICON.lg).toBeLessThan(ICON.xl);
    expect(ICON.xl).toBeLessThan(ICON.xxl);

    expect(S.xs).toBeLessThan(S.sm);
    expect(S.sm).toBeLessThan(S.md);
    expect(S.md).toBeLessThan(S.lg);

    expect(F.caption).toBeLessThan(F.body);
    expect(F.body).toBeLessThan(F.subhead);
    expect(F.subhead).toBeLessThan(F.title);
    expect(F.title).toBeLessThan(F.hero);
  });
});

describe('ölçek disiplini', () => {
  it('borderRadius elle yazılmamalı — R ölçeğini kullan', () => {
    // borderRadius: 12  ✗     borderRadius: R.md  ✓
    const hits = sourcesWithout(/borderRadius:\s*[0-9]/);
    expect(hits).toEqual([]);
  });

  it('lucide ikon boyutu elle yazılmamalı — ICON ölçeğini kullan', () => {
    // Dinamik ikon bileşenleri (const Icon = ...) ve ikon olmayanlar (TazqLogo)
    // bu kontrolün dışında: bunlar lucide etiketiyle çağrılmıyor.
    const KNOWN_NON_ICON = ['TazqLogo', 'DottedBackground'];
    const hits: string[] = [];
    for (const file of FILES) {
      const src = fs.readFileSync(file, 'utf8');
      const lucide = new Set<string>();
      for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'lucide-react-native'/g)) {
        for (const part of m[1].split(',')) {
          const name = part.trim().split(' as ').pop()?.trim();
          if (name) lucide.add(name);
        }
      }
      if (!lucide.size) continue;

      const lines = src.split('\n');
      lines.forEach((line, i) => {
        const m = /\bsize=\{[0-9]+\}/.exec(line);
        if (!m) return;
        const before = line.slice(0, m.index);
        const tags = [...before.matchAll(/<([A-Z][A-Za-z0-9]*)/g)].map((x) => x[1]);
        const comp = tags[tags.length - 1];
        if (!comp || !lucide.has(comp) || KNOWN_NON_ICON.includes(comp)) return;
        hits.push(`${rel(file)}:${i + 1} <${comp}>`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('boşluk elle yazılmamalı — S ölçeğini kullan', () => {
    // padding: 12  ✗     padding: S.smd  ✓
    //
    // Neden ölçek: 869 elle yazılmış boşluk vardı ve en sıkları (12→41 kez, 6→39,
    // 14→32, 10→31) tam olarak ölçeğin DELİKLERİNE düşüyordu. Ölçek tamamlandı
    // (2·4·8·12·16·20·24·32·40·64) ve 840 kullanım en yakın adıma çekildi.
    //
    // İki değer kasıtlı olarak dışarıda:
    //   0        → "boşluk yok" bir ölçek adımı değil, bir ifade. Token'a çevirmek anlamsız.
    //   negatif  → hizalama hilesi (ör. marginTop: -0.5, optik denge). Ölçekten gelmez.
    const props = [
      'padding', 'paddingHorizontal', 'paddingVertical', 'paddingTop', 'paddingBottom',
      'paddingLeft', 'paddingRight', 'paddingStart', 'paddingEnd',
      'margin', 'marginHorizontal', 'marginVertical', 'marginTop', 'marginBottom',
      'marginLeft', 'marginRight', 'marginStart', 'marginEnd',
      'gap', 'rowGap', 'columnGap',
    ].join('|');
    // 0 hariç: sıfır olmayan bir sayıyla başlamalı
    const hits = sourcesWithout(new RegExp(`\\b(${props}):\\s*(?!0\\b)[0-9]`));
    expect(hits).toEqual([]);
  });
});

describe('yazı ağırlığı', () => {
  it('700’ün üstüne çıkılmamalı — iOS’un tavanı', () => {
    // SF Pro'da 800/900 = Heavy/Black. Apple bunları ARAYÜZDE kullanmaz; aşırı ağır
    // yazı "ucuz template" algısının en güçlü tek sinyalidir.
    //
    // 253 kullanım vardı (%30) ve en ağırlar en KÜÇÜK puntolardaydı (9/10/11pt) —
    // çünkü ekranlarda punto hiyerarşisi yok, tek kaldıraç ağırlık kalmış.
    // Doğru çözüm ağırlığı artırmak değil, puntoyu ayırmak (bkz. W, F).
    const hits = sourcesWithout(/fontWeight: '(800|900)'/);
    expect(hits).toEqual([]);
  });
});

describe('istisna listesi', () => {
  it('muaf dosyalar hâlâ var olmalı — liste bayatlamamalı', () => {
    // Dosya silinmiş/taşınmışsa istisna sessizce anlamsızlaşır ve gerekçe yalan söyler.
    const missing = Object.keys(EXEMPT).filter((f) => !fs.existsSync(path.join(ROOT, f)));
    expect(missing).toEqual([]);
  });
});

describe('iOS kart deseni', () => {
  it('BentoCard gölge kullanmamalı', () => {
    // iOS gruplanmış içeriği gölgelemez; ayırmayı zemin kontrastı yapar.
    // Gölge Material Design'ın "yükseklik" metaforu — kart zaten kontrastla ayrılıyorsa
    // gölge eklemek onu zeminde "yüzdürür" ve web/Android dilinde konuşur.
    // Yorumlar hariç: dosyada gölgenin NEDEN olmadığı anlatılıyor, o metin sayılmamalı.
    const src = fs.readFileSync(path.join(ROOT, 'shared/components/BentoCard.tsx'), 'utf8');
    const code = stripComments(src);
    expect(code).not.toMatch(/shadowOpacity|shadowRadius|elevation:/);
  });
});
