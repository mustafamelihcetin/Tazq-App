/**
 * EMOJİ → İKON EŞLEMESİ — eksik eşleme artık SESSİZ değil.
 *
 * ÖLÇÜLEN SORUN: eşleme 125 dallı bir `switch` idi. İki bedeli vardı:
 *
 *  1. Fonksiyon liste satırı başına çağrılıyor (SporCard, modlar, mod-ozet,
 *     TurkishModeBanner); 20 satırlık bir alışkanlık listesi satır başına 125 string
 *     karşılaştırmasına kadar yürüyordu.
 *  2. Eşlemesi olmayan emoji fallback'e düşüp HAM çiziliyordu — yani hata ancak
 *     ekrana bakan biri fark edince görünüyordu. Bir tur önce veri dosyalarındaki
 *     `emoji:` alanları switch ile ELLE karşılaştırılıp 20 eksik bulunmuştu; o
 *     denetimin veri her büyüdüğünde tekrarlanması gerekiyordu.
 *
 * Bu dosya o elle denetimin yerini alır: veri hangi emojiyi kullanıyorsa tablosu
 * olmalı. Yeni bir mod/alışkanlık eklendiğinde eksik eşleme CI'da düşer.
 */
import fs from 'fs';
import path from 'path';
import { MODE_ICONS } from '@/features/modes/utils/modeIcons';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Veri dosyalarındaki `emoji: '…'` alanlarının tamamı. */
const DATA_FILES = [
  'features/modes/utils/turkishModes.ts',
  'features/modes/utils/planAdaptations.ts',
];

function emojisInData(): { emoji: string; file: string }[] {
  const out: { emoji: string; file: string }[] = [];
  for (const f of DATA_FILES) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    for (const m of read(f).matchAll(/emoji:\s*'([^']+)'/g)) {
      out.push({ emoji: m[1], file: f });
    }
  }
  return out;
}

describe('tablo bütünlüğü', () => {
  it('switch\'ten taşınan 125 eşlemenin hepsi duruyor', () => {
    expect(Object.keys(MODE_ICONS).length).toBe(125);
  });

  it('her değer çizilebilir bir bileşen', () => {
    // lucide ikonları React.forwardRef ile sarılı — yani 'function' DEĞİL, 'object'.
    // Ölçüt "tanımlı ve render edilebilir": tanımsız bir ad `<undefined />` ile çöker.
    const broken = Object.entries(MODE_ICONS)
      .filter(([, Icon]) => !Icon || !['function', 'object'].includes(typeof Icon))
      .map(([emoji]) => emoji);
    expect(broken).toEqual([]);
  });

  it('anahtarların hepsi emoji — yanlışlıkla düz metin girmesin', () => {
    // Bayraklar (🇬🇧) Extended_Pictographic DEĞİL, Regional_Indicator çiftidir; ikisini
    // de kabul etmek gerekiyor. Ölçüt: ASCII harf/rakam içermeyen kısa bir dize.
    const bad = Object.keys(MODE_ICONS).filter(
      k => k.length === 0 || k.length > 8 || /[A-Za-z0-9]/.test(k),
    );
    expect(bad).toEqual([]);
  });
});

describe('veri ↔ tablo — ELLE denetimin yerine geçer', () => {
  it('mod/alışkanlık verisindeki her emojinin ikonu var', () => {
    const missing = [...new Set(
      emojisInData().filter(({ emoji }) => !MODE_ICONS[emoji]).map(({ emoji, file }) => `${emoji}  (${file})`),
    )];
    expect(missing).toEqual([]);
  });

  it('denetim gerçekten VERİ okuyor — tarama boşa düşmesin', () => {
    // Regex bozulursa test sessizce "0 eksik" der ve hiçbir şeyi korumaz.
    expect(emojisInData().length).toBeGreaterThan(50);
  });
});

describe('lucide adları kanonik', () => {
  /**
   * lucide birçok ikonu eski adıyla da dışa veriyor (`CircleCheck as CheckCircle2`).
   * Takma ad bugün çalışır ama bir sürümde kalkar; üstelik aynı ikon iki farklı adla
   * yazıldığında tablo tutarsız görünür — '👍' CheckCircle2, '✅' CircleCheck idi.
   */
  const DEPRECATED: Record<string, string> = {
    BarChart4: 'ChartColumnIncreasing',
    CheckCircle2: 'CircleCheck',
    AlertTriangle: 'TriangleAlert',
    XCircle: 'CircleX',
    PlusCircle: 'CirclePlus',
    AlertCircle: 'CircleAlert',
    AlertOctagon: 'OctagonAlert',
  };

  it('tabloda eski takma ad kullanılmıyor', () => {
    const src = read('features/modes/utils/modeIcons.tsx');
    const used = [...src.matchAll(/Lucide\.(\w+)/g)].map(m => m[1]);
    const stale = [...new Set(used.filter(n => DEPRECATED[n]))].map(n => `${n} → ${DEPRECATED[n]}`);
    expect(stale).toEqual([]);
  });
});

describe('davranış korunuyor', () => {
  it('switch geri gelmedi — arama sabit zamanlı', () => {
    const src = read('features/modes/utils/modeIcons.tsx');
    expect(src).not.toContain('switch (emoji)');
    expect(src).toContain('MODE_ICONS[emoji]');
  });

  it('eşlemesi olmayan emoji için fallback KORUNUYOR', () => {
    // Boş bırakmak, ikonu olmayan satırı ikonsuz ve boşluklu göstermek demekti
    // (bkz. spor hedef çiplerinin boş <Text> çizdiği hata).
    const src = read('features/modes/utils/modeIcons.tsx');
    expect(src).toContain('<Text style={{ fontSize: size }}>{emoji}</Text>');
  });

  it('bilinen birkaç eşleme yerinde', () => {
    expect(MODE_ICONS['🌙']).toBeDefined();
    expect(MODE_ICONS['😴']).toBeDefined();
    expect(MODE_ICONS['🏃']).toBeDefined();
    expect(MODE_ICONS['🧘']).toBeDefined();
    // Fall-through gruplar da taşındı
    expect(MODE_ICONS['🌍']).toBe(MODE_ICONS['🌐']);
    expect(MODE_ICONS['🇬🇧']).toBe(MODE_ICONS['🇺🇸']);
  });

  it('koşu ve meditasyon AYRI ikon — bilerek ayrıştırılmıştı', () => {
    expect(MODE_ICONS['🏃']).not.toBe(MODE_ICONS['🧘']);
  });
});
