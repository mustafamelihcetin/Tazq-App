import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * DASHBOARD SIFIR DURUMU — sayfanın ilk sözü.
 *
 * ÖLÇÜLEN SORUN: gün başında dashboard yukarıdan aşağı şunu söylüyordu —
 *   momentum 5 (boş grafikle) · 0/1 görev · %0 halka · "1 gecikmiş görev" (kırmızı)
 *   · beş boş alışkanlık halkası · süresi geçmiş görev (kırmızı)
 * Yani ÜÇ SIFIR ve DÖRT KIRMIZI sinyale karşılık tek bir cesaretlendirici cümle — o da
 * veriyle çelişen bir cümle ("Hadi devam edelim!" derken altında hiçbir şey yapılmadığı
 * yazıyor). Sayfanın en büyük puntosu, sayfadaki en kötü iki sayıya ayrılmıştı.
 *
 * Bu bir SKORBORD ve skor sıfırken skorbord göstermek kimseyi harekete geçirmez, suçlar.
 * Bu testler düzeltmenin geri sızmasını engelliyor — hepsi tek tek "kötü görünmüyordu"
 * diye geri alınabilecek, ayrı ayrı masum görünen kararlar.
 */
describe('dashboard sırası', () => {
  const src = read('app/index.tsx');

  /**
   * SIRA DENENDİ VE GERİ ALINDI. Gün açılmamışken eylem çağrısı sayfanın en üstüne,
   * selamlamanın hemen altına taşınmıştı. Mantığı doğruydu (sayfa skorla değil eylemle
   * açılsın) ama SAYFANIN RİTMİNİ bozdu: momentum satırı kartsızdır ve selamlamayla
   * kartlar arasında yumuşak bir geçiş kuruyordu; üstüne kart konunca iki ağır kartın
   * arasında sıkışıp öksüz kaldı. Doğru mantık, yanlış sonuç.
   */
  it('eylem çağrısı kartların arasında — koşullu sıra YOK', () => {
    expect(src).not.toContain('dayNotStarted');
    expect(src).toContain('{nextMissionCard}');
  });

  it('kart TEK yerde tanımlı — iki konuma kopyalanmadı', () => {
    expect((src.match(/<NextMissionCard/g) ?? [])).toHaveLength(1);
  });

  it('momentum selamlamadan hemen sonra gelir — geçiş satırı', () => {
    const hero = src.indexOf('<DashboardHero');
    const momentum = src.indexOf('<MomentumPulse');
    const today = src.indexOf('<TodayCard');
    expect(hero).toBeLessThan(momentum);
    expect(momentum).toBeLessThan(today);
  });
});

describe('kırmızı yalnız gerçekten bozulan şeyler için', () => {
  it('gecikmiş görev bandı uyarı tonunda — sayfanın ilk rengi kırmızı olmasın', () => {
    const src = read('app/index.tsx');
    const start = src.indexOf('{overdueCount > 0 && (');
    const end = src.indexOf("'overdue tasks'}", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    // JSX blok yorumları da elenmeli — eski renkten SÖZ etmek serbest, yazmak değil.
    const band = src.slice(start, end).replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    expect(band).not.toContain('theme.error');
    expect(band).toContain('theme.warning');
  });

  it('görev satırındaki "Süresi geçti" de uyarı tonunda', () => {
    const src = read('features/dashboard/components/MyDayTaskRow.tsx');
    expect(src).toContain('isOverdue ? theme.warning');
  });

  it('etiket rengi elle KISILMIYOR — ölçülen kontrast korunsun', () => {
    // `opacity: 0.5` palet rengini kullanım yerinde kısıyordu; ölçülmüş kontrastı
    // geçersiz kılar (bkz. colorContrast.test.ts).
    // Yorumlar sayılmaz — eski değerden SÖZ etmek serbest, yazmak değil.
    const code = read('features/dashboard/components/MyDayTaskRow.tsx')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    // Stil bloğunun kapanışına göre değil, etiketin ETRAFINA bakıyoruz: blok yapısı
    // değişince (mod adı ikincil satıra taşındı) eski desen tutmuyordu ve test
    // "eşleşme yok" diye yeşil yanmaya bir adım kalmıştı.
    const label = code.match(/color: isOverdue \? theme\.warning[\s\S]{0,300}/)?.[0] ?? '';
    expect(label).not.toBe('');
    expect(label).not.toMatch(/opacity: 0\.\d/);
  });
});

/**
 * MOMENTUM GİZLENMEZ.
 *
 * Blok bir ara veri yetersizken tamamen kaldırılmıştı. Yanlıştı: çalışan bir özelliği
 * kullanıcıdan saklamak, kötü görünen bir durumu düzeltmek değildir. Gerçek sorun
 * grafiğin YANLIŞ CÜMLE kurmasıydı — "son 7 gün" yazıp neredeyse boş bir grafik
 * göstermek, kullanıcıya "yedi günlük verine bakıyorsun ve düz" dedirtiyordu.
 * Halbuki söylenmesi gereken "grafik henüz dolmadı"ydı.
 */
describe('momentum — gizlenmez, doğru cümleyi kurar', () => {
  const src = read('features/user/components/MomentumPulse.tsx');

  it('veri yetersiz diye blok kaldırılmaz', () => {
    expect(src).not.toContain('if (daysWithData < 3) return null;');
  });

  it('altyazı grafiğin gerçekte ne olduğunu söyler', () => {
    expect(src).toContain('const buildingUp = daysWithData < 3;');
    expect(src).toContain('grafik doluyor');
    expect(src).toContain('chart filling up');
  });
});

describe('bugün kartı — sıfırken susar', () => {
  const src = read('features/dashboard/components/TodayCard.tsx');

  it('gün başı AYRI bir durum olarak tanımlı', () => {
    expect(src).toContain('const notStarted = hasGoal && completed === 0;');
  });

  /**
   * Halka bir ara sifirda tamamen GIZLENMISTI. Cift sifiri cozuyordu ama kartin sag
   * yanini bosaltip karti tek yana yatiriyordu — bir sorunu digeriyle degistirmek.
   * Geometri korunuyor, icindeki sayi degisiyor: bitirdigin degil, hedefledigin.
   */
  it('halka sıfırda da çizilir — kartın sağ yanı boş kalmasın', () => {
    expect(src).not.toContain('{!notStarted && <View style={styles.ringBox}>');
  });

  it('sıfırda halkanın içi HEDEFİ gösterir, yüzdeyi değil', () => {
    expect(src).toContain('testID="today-goal"');
    expect(src).toMatch(/notStarted \? \(/);
  });

  it('alt satır sıfırda ileri bakar', () => {
    expect(src).toContain("'gün yeni başlıyor'");
    expect(src).toContain("'the day is just starting'");
  });
});

/**
 * GÜNÜ TAMAMLAMA ANI — kullanıcıyı geri getiren tek an.
 *
 * Günün %100'ünü bitirmenin karşılığı 90pt'lik bir halkanın yeşile dönmesi ve 11pt'lik
 * bir satırdı. Sayfa RAPOR veriyordu, ödül vermiyordu. Kutlama katmanı zaten vardı ama
 * yalnız başarımlara bağlıydı — yani ömürde bir kez.
 */
describe('günü tamamlama kutlaması', () => {
  const store = read('features/user/store/useAchievementStore.ts');
  const src = read('app/index.tsx');

  it('geçici kutlama hiçbir şeyi kalıcı yapmaz', () => {
    // `trigger` id başına tek seferlik ve doğrusu bu. Tekrarlanan anlar için ayrı yol
    // gerekiyordu; tarihli id (`daily_2026_07_27`) kullanmak `unlocked` dizisini her gün
    // şişirir, buluta senkronlar ve profildeki rozet ızgarasını çöple doldururdu.
    const body = (store.match(/celebrate: \(achievement\) => \{[\s\S]*?\n      \},/)?.[0] ?? '')
      // Yorumlar sayılmaz — neden `unlocked`a YAZMADIĞINI anlatmak serbest.
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    expect(body).not.toBe('');
    expect(body).not.toContain('unlocked');
    expect(body).not.toContain('pushCloud');
  });

  it('üç kapı da yerinde — yanlış kutlama olmasın', () => {
    const eff = src.match(/const dayCompleteRef[\s\S]*?\}, \[todayCompleted, dailyGoal\]\);/)?.[0] ?? '';
    expect(eff).not.toBe('');
    // 1. yalnız geçiş anı: gün zaten bitmişken uygulamayı açmak kutlama değildir
    expect(eff).toContain('if (prev !== false || !done) return;');
    // 2. günde bir: yeniden kurulum / son görevi geri alıp tekrar işaretleme
    expect(eff).toContain('@day_celebrated_');
    // 3. ilk mükemmel günde rozet kendi kutlamasını yapıyor — üst üste binmesin
    expect(eff).toContain("hasUnlocked('daily_perfect')");
  });
});

/**
 * EMOJİ YOK — uygulama flat ikon (lucide) kullanıyor.
 *
 * Emoji üç sebeple yanlış: tek bir emoji sistemi bozar; cihaza göre farklı çizilir,
 * yani tasarım bizim kontrolümüzde değildir; ve rengini kendi taşıdığı için paletle
 * konuşmaz. En çok da BAŞARI anında zarar veriyordu — "premium" hissetmesi gereken
 * yerde ekrana bir emoji çıkıyordu.
 */
describe('dashboard metinlerinde emoji yok', () => {
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  const FILES = [
    'app/index.tsx',
    'app/tasks.tsx',
    'features/dashboard/components/TodayCard.tsx',
    'features/dashboard/components/NextMissionCard.tsx',
  ];

  it.each(FILES)('%s', (rel) => {
    const offenders = read(rel)
      .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')   // yorumda eski emojiden SÖZ etmek serbest
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*')) return false;
        // `emoji: '📚'` bir ANAHTAR, ekrana çıkan metin değil: renderModeEmojiIcon onu
        // Lucide glifine çeviriyor (bkz. features/modes/utils/modeIcons.tsx). Kuralın
        // hedefi kullanıcıya GÖSTERİLEN emoji.
        if (/^emoji: '/.test(t)) return false;
        return EMOJI.test(l);
      })
      .map((l) => l.trim().slice(0, 80));
    expect(offenders).toEqual([]);
  });
});

describe('alışkanlık baloncuğu — etiket sığmalı', () => {
  it('yuva baloncuktan belirgin geniş', () => {
    // 268 addan 218'i 18 karakterden uzun ve bu veri hatası değil ("Kavram Haritası
    // Çıkarma" doğal uzunlukta). Sorun 62pt'lik kutuydu: satır başına ~13 karakter.
    const src = read('features/dashboard/components/MyDayHabits.tsx');
    const slot = Number(src.match(/const SLOT = (\d+);/)?.[1]);
    const bubble = Number(src.match(/const BUBBLE = (\d+);/)?.[1]);
    expect(slot).toBeGreaterThanOrEqual(bubble + 24);
  });

  it('etiket iki satır — tek satırda adların neredeyse hepsi kesiliyordu', () => {
    expect(read('features/habits/components/HabitBubble.tsx')).toContain('numberOfLines={2}');
  });
});
