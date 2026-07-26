import fs from 'fs';
import path from 'path';

/**
 * KURULUM AKISI — "kullaniciya sormadan karar verme" bekcisi.
 *
 * Bildirilen hata: "Plani actim sinavi sectim fakat direkt olusturdu. plan falan
 * gelmedi saati falan da secmemistim."
 *
 * Iki ayri sessiz-varsayilan bulundu:
 *   1. ExamCard — preset secilir secilmez `setDailyMinutes(preset.defaultDailyMinutes)`
 *      calisiyordu. Gunluk sure seviyeyi (Temel/Orta/Ileri) belirledigi icin plan
 *      seviyesi kullaniciya SORULMADAN secilmis oluyordu.
 *   2. SporCard — "Kilo Yonetimi" secilince `setCurrentWeight('75')` /
 *      `setTargetWeight('70')` uyduruluyordu. Daha kotusu: `sporInputsComplete`
 *      alanlarin DOLU olmasina baktigi icin sahte deger o guardi gecersiz kiliyor,
 *      kullanici hic kilo girmeden 75->70 varsayimi uzerine plan aliyordu.
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

describe('sinav kurulumu', () => {
  const src = strip(read('features/modes/components/modes/ExamCard.tsx'));

  it('gunluk sure sessizce doldurulmaz', () => {
    expect(src).not.toMatch(/setDailyMinutes\(\s*preset[?.]*\.defaultDailyMinutes/);
  });

  it('preset degisince onceki sure secimi sifirlanir', () => {
    expect(src).toMatch(/useEffect\(\(\) => \{ setDailyMinutes\(null\); \}, \[preset\?\.id\]\)/);
  });

  it('kurulum UC adimi da zorunlu tutar: ad + tarih + sure', () => {
    const conds = src.match(/const (?:is)?[Cc]omplete = name\.trim\(\)[^;]*/g) ?? [];
    expect(conds.length).toBeGreaterThanOrEqual(2); // ana kart + ikincil slot
    for (const c of conds) {
      expect(c).toContain("date !== ''");
      expect(c).toContain('!!preset');
      expect(c).toContain('dailyMinutes !== null');
    }
  });

  it('eksik adim SOYLENIR — dugme sessizce kaybolmaz', () => {
    expect(src).toContain("'Günlük süreni seç'");
    expect(src).toContain("'Sınav tarihini seç'");
  });
});

describe('spor kurulumu', () => {
  const src = strip(read('features/modes/components/modes/SporCard.tsx'));

  it('kilo hedefi secilince kilo UYDURULMAZ', () => {
    expect(src).not.toMatch(/setCurrentWeight\('\d+'\)/);
    expect(src).not.toMatch(/setTargetWeight\('\d+'\)/);
  });

  it('kilo plani gercek kilo girilmeden tamamlanmis sayilmaz', () => {
    expect(src).toContain("currentWeight.trim() !== '' && targetWeight.trim() !== ''");
  });
});

describe('havuz ucu — istemci ve sunucu ayni faz kumesini konusmali', () => {
  it('mulakat bantlari sunucuda taninir', () => {
    // Bulunan hata: istemci mulakat icin far/mid/near/eve gonderiyordu, sunucu
    // yalnizca sinav fazlarini (foundation...sprint) kabul ediyordu -> her cagri 400.
    const be = read('../Tazq-Backend/Services/GroqService.cs');
    for (const band of ['far', 'mid', 'near', 'eve']) {
      expect(be).toContain(`"${band}"`);
    }
  });

  it('istemcinin urettigi TUM faz degerleri sunucunun kumesinde', () => {
    const fe = read('shared/utils/dailyPlanEngine.ts');
    const be = read('../Tazq-Backend/Services/GroqService.cs');
    const allowed = be.match(/AllowedPhases = new\(\)\s*\{([\s\S]*?)\};/)?.[1] ?? '';
    // Sinav/tez fazlari
    for (const p of ['foundation', 'deepen', 'reinforce', 'accelerate', 'sprint']) {
      expect(fe).toContain(p);
      expect(allowed).toContain(`"${p}"`);
    }
  });
});

describe('alışkanlık simge seçicisi', () => {
  /**
   * Bildirilen hata: "Yeni alışkanlık ekranındaki ikonlarda tekrarlı olanlar var,
   * kalp atışı gibi olan mesela."
   * Sebep: 🏃 (koşu) ve 🧘 (meditasyon) ikisi de `Activity` glifine eşleniyordu.
   */
  const iconMap = () => {
    const src = read('features/modes/utils/modeIcons.tsx');
    const pairs = [...src.matchAll(/case '([^']+)':\s*\n(?:\s*\/\/[^\n]*\n)*\s*return <Lucide\.(\w+)/g)];
    const map = new Map<string, string>();
    for (const [, emoji, icon] of pairs) if (!map.has(emoji)) map.set(emoji, icon);
    return map;
  };

  const pickerEmojis = () => {
    const src = read('app/cockpit.tsx');
    const block = src.match(/const HABIT_EMOJIS = \[([\s\S]*?)\];/)?.[1] ?? '';
    return [...block.matchAll(/'([^']+)'/g)].map(m => m[1]);
  };

  it('seçicideki her simge FARKLI bir glife eşlenir', () => {
    const map = iconMap();
    const used = new Map<string, string[]>();
    for (const e of pickerEmojis()) {
      const icon = map.get(e);
      if (!icon) continue;
      used.set(icon, [...(used.get(icon) ?? []), e]);
    }
    const dups = [...used.entries()].filter(([, es]) => es.length > 1)
      .map(([icon, es]) => `${icon} <- ${es.join(' ')}`);
    expect(dups).toEqual([]);
  });

  it('seçicideki her simgenin bir glif eşlemesi VAR', () => {
    // Eşleme yoksa ham emoji çizilir ve çizgisel ikonların yanında yamalı durur.
    const map = iconMap();
    const missing = pickerEmojis().filter(e => !map.has(e));
    expect(missing).toEqual([]);
  });

  it('mod ikonları çizgiseldir — dolu (fill) glif yok', () => {
    // ⭐ ve ❤️ `fill={color}` ile DOLU çiziliyordu; 82 ikonun 79'u çizgiselken
    // bu üçü diğerleriyle uyuşmuyordu.
    expect(read('features/modes/utils/modeIcons.tsx')).not.toMatch(/fill=\{color\}/);
  });

  it('seçenek sayısı artırıldı ve ızgarada gösterilir', () => {
    expect(pickerEmojis().length).toBeGreaterThanOrEqual(24);
    expect(read('app/cockpit.tsx')).toMatch(/flexWrap: 'wrap', gap: S\.sm, paddingVertical: S\.xxs/);
  });
});

describe('klavye güvenliği — metin girişi olan alt sayfalar', () => {
  /**
   * Bildirilen hata: "alışkanlık ekleme ekranında textboxa basınca klavye açılınca
   * textbox ekranın üstünden taşıyor."
   *
   * Kök neden: sheet gövdesi KAYDIRILAMIYORDU ve `maxHeight` TAM EKRAN yüksekliğine
   * göre hesaplanmıştı — klavyenin kapladığı alan hesaba katılmıyordu. İçerik
   * uzadıkça (simge ızgarası 1 satırdan 7 satıra çıkınca) taşma görünür oldu.
   *
   * Kural: metin girişi olan bir modal ya klavyeyi hesaba katan bir sarmalayıcıya
   * (KeyboardAvoidingView) ya da kendi klavye ölçümüne sahip olmalı; gövdesi
   * kaydırılabilir olmalı ve kalan alana küçülebilmeli (flexShrink).
   */
  const FILES = [
    'app/cockpit.tsx',
    'shared/components/WeightEntryModal.tsx',
    'features/user/components/ReviewPromptModal.tsx',
  ];

  it.each(FILES)('%s klavye açılınca içeriği taşırmaz', (f) => {
    const src = read(f);
    expect(src).toContain('KeyboardAvoidingView');
    // Gövde daralan alana sığabilmeli.
    expect(src).toMatch(/flexShrink: 1/);
  });

  it('alışkanlık sayfası gövdesi kaydırılabilir', () => {
    const src = read('app/cockpit.tsx');
    expect(src).toMatch(/keyboardShouldPersistTaps="handled"/);
    expect(src).toMatch(/keyboardDismissMode="on-drag"/);
  });
});

describe('mod kapatma — artık görev bırakmaz', () => {
  /**
   * Bildirilen hata: "kaldırdığım dönem modunun (toggle off) görevi hâlâ YAPILDI
   * olarak görevler arasında duruyordu."
   *
   * Kök neden: kartlar kapanırken YALNIZCA id tabanlı temizlik yapıyordu
   * (`planTaskIds.forEach(retirePlanTask)`). Bir görev o listeden düşmüşse
   * (offline tempId→realId kayması, başarısız silme, prefs sıfırlanması) ekranda
   * kalıyordu. Etiket tabanlı süpürme vardı ama YALNIZCA uygulama açılışında
   * (`usePlanAdaptations.run`) çalışıyordu — yani kullanıcı kapattığı anda değil.
   *
   * Çözüm: `retireModeTasksByTag` tek kaynağa taşındı ve HER kapatma yoluna bağlandı.
   */
  const CLOSERS = [
    'features/modes/components/modes/ExamCard.tsx',
    'features/modes/components/modes/TezCard.tsx',
    'features/modes/components/modes/MulakatCard.tsx',
    'features/modes/components/modes/SporCard.tsx',
    'features/modes/components/modes/RamazanCard.tsx',
    'shared/components/TasarrufCard.tsx',
    'shared/components/BirakmaCard.tsx',
  ];

  it.each(CLOSERS)('%s kapanırken etiket tabanlı süpürme yapar', (f) => {
    expect(read(f)).toContain('retireModeTasksByTag(');
  });

  it('etiket tablosu TEK kaynakta — ikinci kopya yok', () => {
    const ops = read('shared/utils/planTaskOps.ts');
    expect(ops).toContain('export const MODE_TASK_TAGS');
    // usePlanAdaptations kendi kopyasini tutmamali, paylasilani ithal etmeli.
    const hook = read('features/modes/hooks/usePlanAdaptations.ts');
    expect(hook).not.toMatch(/const MODE_TASK_TAGS: Record<string, string\[\]> = \{/);
    expect(hook).toMatch(/MODE_TASK_TAGS.*from '@\/shared\/utils\/planTaskOps'/);
  });

  it('süpürme TAMAMLANMIŞ görevleri de kaldırır', () => {
    // Bildirilen gorev "yapildi" durumundaydi; `!isCompleted` filtresi olmamali.
    const ops = read('shared/utils/planTaskOps.ts');
    const fn = ops.match(/export function retireModeTasksByTag[\s\S]*?\n\}/)?.[0] ?? '';
    expect(fn).not.toMatch(/isCompleted/);
    // Istatistik kaybolmasin: retirePlanTask tamamlanani once journal'a isler.
    expect(ops).toMatch(/if \(task\?\.isCompleted\)[\s\S]{0,120}useCompletionStore/);
  });

  it('kilo geçmişi süpürmeden MUAF kalır', () => {
    const ops = read('shared/utils/planTaskOps.ts');
    const table = ops.match(/export const MODE_TASK_TAGS[\s\S]*?\n\};/)?.[0] ?? '';
    expect(table).not.toContain('weight_entry');
  });
});
