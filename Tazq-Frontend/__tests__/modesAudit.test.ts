import fs from 'fs';
import path from 'path';
import { tickFrom } from '@/features/modes/hooks/useCountdownTick';

/**
 * YAŞAM MODLARI DENETİMİ (2026-10-31) — ölçülen kusurlar.
 *
 *  1. Mod açık ama kurulum yarımken üst kart "Bir hedef seç" diyordu; kullanıcı
 *     zaten seçmişti. Yarım kurulum varsa kart onu söyler.
 *  2. Davet metni altı moddan dördünü sayıyordu (tasarruf ve bırakma yoktu).
 *  3. Sınav kartında zayıf konu seçicisi 35+ çipi açık döküyordu; isteğe bağlı bir
 *     ayrıntı kartın yarısını kaplıyordu. Uzun listede varsayılan KAPALI.
 *  4. "Deadline", "check-in" Türkçe arayüzde İngilizce kalıyordu.
 *  5. Keşif listesi spor ile başlıyordu; ürünün çekirdek kitlesi sınav hazırlığı.
 */

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const MODLAR = read('app/modlar.tsx');
const CARD = read('features/modes/components/ModeStatusCard.tsx');
const PICKER = read('features/modes/components/WeakAreaPicker.tsx');

describe('durum kartı yarım kurulumu tanır', () => {
  it('modlar ekranı bekleyen kurulum sayısını karta geçirir', () => {
    expect(MODLAR).toMatch(/pendingCount=\{demoStatus \? 0 : pendingCards\.length\}/);
  });

  it('kart aktif hedef yokken bekleyen kurulumu davetten ayırır', () => {
    expect(CARD).toContain('pendingCount');
    expect(CARD).toMatch(/pendingTitle: \(n: number\) => `\$\{n\} hedef planını bekliyor`/);
  });

  it('davet altı modun hepsini anar', () => {
    const tr = CARD.match(/inviteBody: '([^']*)'/)![1];
    for (const w of ['Sınav', 'tez', 'mülakat', 'spor', 'tasarruf', 'bırak']) expect(tr).toContain(w);
  });
});

describe('zayıf konu seçicisi', () => {
  it('uzun listede varsayılan kapalı, açılır satır durumunu bildirir', () => {
    expect(PICKER).toMatch(/const COLLAPSE_AT = \d+/);
    expect(PICKER).toContain('useState(false)');
    expect(PICKER).toContain('accessibilityState={{ expanded: open }}');
  });
});

describe('Türkçe metin', () => {
  it('Deadline ve check-in Türkçe arayüzde yok', () => {
    const trOnly = [MODLAR, read('features/modes/components/modes/TezCard.tsx')]
      .join('\n')
      .match(/'[^'\n]*'/g)!
      .filter(s => /Deadline|check-in/.test(s) && !/Deadline-driven|Deadline passed|e\.g\.|habits ·/.test(s));
    expect(trOnly).toEqual([]);
  });
});

describe('keşif listesi', () => {
  it('sınav ile başlar', () => {
    const block = MODLAR.slice(MODLAR.indexOf('const discoveryItems'));
    const exam = block.indexOf("key: 'exam'");
    const spor = block.indexOf("key: 'spor'");
    expect(exam).toBeGreaterThan(-1);
    expect(exam).toBeLessThan(spor);
  });
});

describe('mod kapatma — anahtar kılığında sil düğmesi yok', () => {
  /*
    Kart yalnız mod açıkken listeleniyordu: anahtar hep "açık", kapatınca plan siliniyordu.
    Çarpı "çıkmaya yöneltiyor", "⋯" kapatmayla ilgisiz bulundu. Uygulamanın kalıbı:
    ağır eylem kartın EN ALTINDA sakin bir satır.
  */
  const CARDS = ['ExamCard', 'MulakatCard', 'SporCard', 'TezCard', 'BirakmaCard', 'TasarrufCard'];
  it.each(CARDS)('%s anahtar taşımaz, kapatma satırı kartın sonunda', (name) => {
    const src = read(`features/modes/components/modes/${name}.tsx`);
    expect(src).not.toContain('<Switch');
    const at = src.indexOf('<ModeCardClose');
    expect(at).toBeGreaterThan(-1);
    // Satırdan sonra ana kartın kapanışından başka JSX yok.
    expect(src.slice(at).match(/<[A-Z]\w*/g)).toEqual(['<ModeCardClose']);
  });

  it('kapatma tek pencere + geri al bildirimi', () => {
    const btn = read('features/modes/components/ModeCardClose.tsx');
    expect(btn).toContain("style: 'destructive', onPress: onClose");
    for (const name of CARDS) expect(read(`features/modes/components/modes/${name}.tsx`)).toMatch(/onClose=\{\(\) => \{ if \([^)]+\) closeModeWithUndo\(/);
  });

  it('Ramazan anahtarının adı var (orada anahtar gerçek: kapalıyken öneri olarak görünür)', () => {
    expect(read('features/modes/components/modes/RamazanCard.tsx')).toContain('accessibilityLabel={RAMADAN_SWITCH[langOf(language)]}');
  });
});

describe('seçim çipleri seçili durumu bildirir', () => {
  it('mod kartlarında "active" ile boyanan her çip accessibilityState taşır', () => {
    const files = ['BirakmaCard', 'ExamCard', 'SporCard', 'TasarrufCard'].map(f => read(`features/modes/components/modes/${f}.tsx`));
    for (const src of files) expect(src).toContain('accessibilityState={{ selected: active }}');
    expect(PICKER).toContain('accessibilityState={{ selected: active }}');
  });
});

describe('yaşayan sayfa — animasyon bilgi taşır ve durur (2026-10-31)', () => {
  const RING = read('features/modes/components/RoadRing.tsx');
  const TICK = read('features/modes/hooks/useCountdownTick.ts');

  it('yol halkası gerçek başlangıçtan hesaplanır, bilinmiyorsa uydurulmaz', () => {
    expect(MODLAR).toContain('progress: roadProgress(planSpecs[slot]?.startDate, days)');
    expect(RING).toContain('progress != null && progress > 0');
    expect(RING).toContain('const play = first && !reduce');
  });

  it('her geri sayım çağrısı kendi yuvasının tarihini okur', () => {
    for (const slot of ['exam2', 'mulakat3', 'spor2', 'tasarruf']) {
      const line = MODLAR.split('\n').find(l => l.includes(`pushCand(`) && l.includes(`seasonal.${slot}Date`));
      expect(line?.trim().endsWith(`, '${slot}');`)).toBe(true);
    }
  });

  it('geri sayım yalnız GERÇEKTEN azaldıysa akar', () => {
    expect(tickFrom(43, 42)).toBe(43);
    expect(tickFrom(42, 42)).toBeUndefined();
    expect(tickFrom(undefined, 42)).toBeUndefined();
    expect(tickFrom(40, 42)).toBeUndefined(); // tarih ileri alındı: sahte geri sayım yok
    expect(TICK).toContain('ready');
  });

  it('kartlar, bölümler ve keşif satırları sıçramaz, akar', () => {
    expect((MODLAR.match(/layout=\{FLOW\}/g) || []).length).toBe(4);
    expect(MODLAR).toContain('exiting={LEAVE}');
  });
});
