import {
  weekRange, summarizeWeek, compareWeeks, weekStory, weekLabel, shortDayLabels,
  habitDenominator, taskDayKey, sessionDayKey, planProgress,
} from '@/features/report/weeklyReport';
import { PLAN_MODE_TAGS } from '@/features/modes/utils/modeHelpers';

/**
 * HAFTALIK ÖZET — sayının TANIMI.
 *
 * ── ÖLÇÜLEN SORUNLAR ────────────────────────────────────────────────────────
 *  1. Görevler VADE gününe göre sayılıyordu: dün vadeli işi bugün bitirince bugüne
 *     yazılmıyordu, tarihsiz görevler ise hiç sayılmıyordu.
 *  2. Günler UTC'ye göre kırılıyordu: gece 00:30'daki odak bir önceki güne düşüyordu.
 *  3. Alışkanlık oranının paydası her zaman "alışkanlık × 7" idi: salı günü her şeyi
 *     yapan kullanıcı %29 görüyordu.
 *  4. Kokpit ile rapor aynı haftayı AYRI hesaplıyordu.
 *  5. Gün adları sunucudan İngilizce geliyordu ("Mo, Tu, We").
 */

// Pazartesi 15 Eylül 2026 → Pazar 21 Eylül 2026 (yerel)
const MONDAY = new Date(2026, 8, 14, 10, 0, 0);
const range = weekRange(MONDAY);
const prevRange = weekRange(MONDAY, -1);
const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m, d, h, min).toISOString();

describe('hafta sınırı ve gün anahtarı YEREL', () => {
  it('hafta pazartesi başlar, pazar biter', () => {
    expect(range.days).toEqual([
      '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20',
    ]);
    expect(prevRange.startKey).toBe('2026-09-07');
  });

  it('hafta içi herhangi bir günden aynı hafta bulunur', () => {
    expect(weekRange(new Date(2026, 8, 20, 23, 30)).startKey).toBe(range.startKey);
  });

  it('gece yarısından sonraki seans O GÜNE yazılır — UTC kayması yok', () => {
    // 00:30 yerel: UTC'de bir önceki gün olabilir; kullanıcının takviminde bugündür.
    expect(sessionDayKey(local(2026, 8, 16, 0, 30))).toBe('2026-09-16');
  });
});

describe('görev = TAMAMLANDIĞI gün', () => {
  it('dün vadeli, bugün biten iş BUGÜNE yazılır', () => {
    expect(taskDayKey({ isCompleted: true, completedAt: local(2026, 8, 16), dueDate: '2026-09-15T00:00:00Z' }))
      .toBe('2026-09-16');
  });

  it('tarihsiz görev de sayılır', () => {
    expect(taskDayKey({ isCompleted: true, completedAt: local(2026, 8, 16), dueDate: null })).toBe('2026-09-16');
  });

  it('eski kayıtta (completedAt yok) vade günü yedek olur', () => {
    expect(taskDayKey({ isCompleted: true, dueDate: '2026-09-15T00:00:00Z' })).toBe('2026-09-15');
  });

  it('tamamlanmamış görev hiç sayılmaz', () => {
    expect(taskDayKey({ isCompleted: false, dueDate: '2026-09-15T00:00:00Z' })).toBeNull();
  });
});

describe('haftanın özeti', () => {
  const sessions = [
    { startedAt: local(2026, 8, 14, 9), minutes: 25 },
    { startedAt: local(2026, 8, 16, 21), minutes: 50 },
    { startedAt: local(2026, 8, 16, 23, 40), minutes: 10 },
    { startedAt: local(2026, 8, 7, 9), minutes: 999 }, // geçen hafta — bu haftaya girmez
  ];
  const tasks = [
    { isCompleted: true, completedAt: local(2026, 8, 14), dueDate: null },
    { isCompleted: true, completedAt: local(2026, 8, 16), dueDate: '2026-09-10T00:00:00Z' },
    { isCompleted: false, completedAt: null, dueDate: '2026-09-16T00:00:00Z' },
  ];
  const habits = [
    { id: 'h1', completedDates: ['2026-09-14', '2026-09-15'], createdAt: local(2026, 8, 1) },
    { id: 'h2', completedDates: ['2026-09-14'], createdAt: local(2026, 8, 1) },
  ];
  const now = new Date(2026, 8, 16, 12, 0); // hafta ortası: çarşamba

  const sum = summarizeWeek({ sessions, tasks, habits, range, now });

  it('odak dakikaları doğru güne düşer, başka hafta karışmaz', () => {
    expect(sum.focusPerDay).toEqual([25, 0, 60, 0, 0, 0, 0]);
    expect(sum.totalFocusMin).toBe(85);
    expect(sum.activeDays).toBe(2);
    expect(sum.bestDayIndex).toBe(2); // çarşamba
  });

  it('görevler tamamlandıkları güne yazılır', () => {
    expect(sum.tasksPerDay).toEqual([1, 0, 1, 0, 0, 0, 0]);
    expect(sum.totalTasks).toBe(2);
  });

  it('alışkanlık oranının paydası YAŞANMIŞ günler — hafta ortasında %100 mümkün', () => {
    // 2 alışkanlık × 3 gün (Pzt-Çar) = 6 beklenen, 3 yapılmış → %50
    expect(sum.habitPct).toBe(50);
    const perfect = summarizeWeek({
      sessions: [], tasks: [],
      habits: [{ id: 'h1', completedDates: ['2026-09-14', '2026-09-15', '2026-09-16'], createdAt: local(2026, 8, 1) }],
      range, now,
    });
    expect(perfect.habitPct).toBe(100);
  });

  it('alışkanlık kurulmadan önceki günler beklenmez', () => {
    const days = range.days;
    // Çarşamba kurulmuş alışkanlık: yalnız çarşamba beklenir (bugün çarşamba)
    expect(habitDenominator([{ id: 'h', createdAt: local(2026, 8, 16) }], days, '2026-09-16')).toBe(1);
    expect(habitDenominator([{ id: 'h', createdAt: local(2026, 8, 1) }], days, '2026-09-16')).toBe(3);
  });
});

describe('geçen haftayla kıyas', () => {
  const cur = summarizeWeek({ sessions: [{ startedAt: local(2026, 8, 14, 9), minutes: 90 }], tasks: [], habits: [], range, now: new Date(2026, 8, 20) });
  const prev = summarizeWeek({ sessions: [{ startedAt: local(2026, 8, 7, 9), minutes: 50 }], tasks: [], habits: [], range: prevRange, now: new Date(2026, 8, 20) });

  it('fark hesaplanır', () => {
    expect(compareWeeks(cur, prev)).toMatchObject({ focusMin: 40, comparable: true });
  });

  it('geçen hafta BOŞSA kıyas yapılmaz — yanıltıcı "sonsuz artış" olmaz', () => {
    const empty = summarizeWeek({ sessions: [], tasks: [], habits: [], range: prevRange, now: new Date(2026, 8, 20) });
    expect(compareWeeks(cur, empty).comparable).toBe(false);
    expect(compareWeeks(cur, null).comparable).toBe(false);
  });
});

describe('haftanın hikâyesi ve etiketler', () => {
  const cur = summarizeWeek({
    sessions: [{ startedAt: local(2026, 8, 16, 9), minutes: 90 }],
    tasks: [{ isCompleted: true, completedAt: local(2026, 8, 16), dueDate: null }],
    habits: [], range, now: new Date(2026, 8, 20),
  });

  it('cümle kurar: kaç gün, en iyi gün, kaç iş, kıyas', () => {
    const prev = summarizeWeek({ sessions: [{ startedAt: local(2026, 8, 7, 9), minutes: 50 }], tasks: [], habits: [], range: prevRange, now: new Date(2026, 8, 20) });
    const story = weekStory(cur, compareWeeks(cur, prev), 'tr');
    expect(story).toContain('1 gün odaklandın');
    expect(story).toContain('Çarşamba');
    expect(story).toContain('1 iş bitirdin');
    expect(story).toContain('40 dakika daha fazla');
  });

  it('boş haftada suçlayıcı değil, davet eden bir cümle', () => {
    const empty = summarizeWeek({ sessions: [], tasks: [], habits: [], range, now: new Date(2026, 8, 20) });
    expect(weekStory(empty, compareWeeks(empty, null), 'tr')).toContain('Tek bir seans');
  });

  it('hangi haftaya bakıldığı yazılır', () => {
    expect(weekLabel(range, 'tr')).toBe('14 – 20 Eyl');
    expect(weekLabel(weekRange(new Date(2026, 8, 30)), 'tr')).toBe('28 Eyl – 4 Eki');
  });

  it('gün adları arayüzün dilinde ve BİRBİRİNDEN AYRI', () => {
    // İki harf Türkçede yetmiyordu: Pazartesi/Pazar "Pa", Cuma/Cumartesi "Cu" olurdu.
    const tr = shortDayLabels('tr');
    expect(tr).toEqual(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);
    expect(new Set(tr).size).toBe(7);
    expect(shortDayLabels('en')[0]).toBe('Mon');
  });
});

describe('mod planı ilerlemesi', () => {
  /*
    Rapor yalnız odağı ve serbest görevleri gösteriyordu; dönemsel mod kullanan
    kullanıcı planının bu hafta ne kadarını tamamladığını hiçbir yerde göremiyordu.
  */
  const planTask = (due: string, done: boolean, tag = 'exam') =>
    ({ isCompleted: done, completedAt: null, dueDate: due, tags: [tag] });

  it('bu haftaya PLANLANMIŞ mod görevlerini sayar', () => {
    const p = planProgress([
      planTask('2026-09-15T00:00:00Z', true),
      planTask('2026-09-16T00:00:00Z', false),
      planTask('2026-09-30T00:00:00Z', true),            // başka hafta
      { isCompleted: true, completedAt: null, dueDate: '2026-09-15T00:00:00Z', tags: [] }, // plan değil
    ], range, PLAN_MODE_TAGS);
    expect(p).toEqual({ total: 2, done: 1 });
  });

  it('plan görevi yoksa bölüm boş kalır (total 0)', () => {
    expect(planProgress([{ isCompleted: true, dueDate: '2026-09-15T00:00:00Z', tags: ['iş'] }], range, PLAN_MODE_TAGS))
      .toEqual({ total: 0, done: 0 });
  });

  it('plan etiketleri TEK listeden gelir', () => {
    // Liste kod tabanında beş ayrı yerde, farklı içeriklerle kopyalanmıştı.
    expect(PLAN_MODE_TAGS).toContain('exam');
    expect(PLAN_MODE_TAGS).toContain('ramazan');
    expect(PLAN_MODE_TAGS).toContain('birakma');
  });
});

describe('haftalık yüzeylerin ROL AYRIMI', () => {
  /*
    İki ekran da "haftalık" adını taşıyor ve aynı haftayı anlatıyordu; kullanıcı
    hangisine bakacağını bilemiyordu. Kokpit = bu hafta (şimdi), Geri Bakış = geçmiş
    ve kıyas. Kokpit başlığındaki "+" ise alışkanlık ekliyordu — aynı iş ekranın
    içinde iki yerde daha duruyordu, yani çubukta yeni bir şey sunmuyordu.
  */
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const COCKPIT = read('app/cockpit.tsx');
  const REPORT = read('app/report.tsx');

  it('Kokpit başlığındaki eylem Geri Bakış; fazlalık ekle düğmesi yok', () => {
    /*
      Sağdaki düğme alışkanlık ekliyordu — aynı iş ekranın içinde iki yerde daha vardı.
      Sol yuvaya konan "Bugün" kısayolu da geri alındı: o ekran yalnız BUGÜNÜ açıyor,
      oysa burada kullanıcı gün seçiyor; seçimi yok sayan bir düğme yanıltıcıydı.
    */
    const header = COCKPIT.slice(COCKPIT.indexOf('<ScreenHeader'), COCKPIT.indexOf('<View style={{ flex: 1 }}>'));
    expect(header).toContain("router.push('/report')");  // sağ: geçmişe uzaklaş
    expect(header).not.toContain('setAddVisible(true)'); // fazlalık "+" kalktı
  });

  it('alışkanlık ekleme ekranın İÇİNDE hâlâ var — kaldırılan şey yalnız tekrardı', () => {
    expect((COCKPIT.match(/setAddVisible\(true\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('iki ekran aynı hesap motorunu kullanır', () => {
    for (const src of [COCKPIT, REPORT]) {
      expect(src).toContain("from '@/features/report/weeklyReport'");
      expect(src).toContain('summarizeWeek(');
    }
  });

  it('Kokpit haftalık sayıları artık sunucunun kendi kırılımından almıyor', () => {
    // Eski yol: /stats → weeklyFocus (UTC günleri). Geri Bakış ile çelişiyordu.
    expect(COCKPIT).not.toContain('FocusService.getStats()');
  });
});

describe('Haftalık Merkez — gün seçimi EKRANIN TAMAMINI kapsar', () => {
  /*
    ── ÖLÇÜLEN SORUNLAR ──────────────────────────────────────────────────────
     1. Ekranın ana jesti gün seçmekti ama alışkanlıklar hep BUGÜNE yazılıyordu:
        çarşambaya dokununca görevler değişiyor, alışkanlıklar değişmiyordu. "Dün
        yaptım, işaretlemeyi unuttum" hiçbir şekilde düzeltilemiyordu.
     2. Alışkanlık satırında dört jest vardı, biri açıklanmıştı: satıra dokunmak
        görünür hiçbir şey yapmıyor, silmek yalnız basılı tutmada gizli duruyordu.
     3. Haftanın sayıları telefonda en alttaydı (ekranın adını taşıdıkları hâlde).
     4. Şeritteki nokta yalnız görevleri sayıyordu; alışkanlık takip eden kullanıcının
        haftası boş görünüyordu.
  */
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const COCKPIT = fs.readFileSync(path.join(__dirname, '..', 'app/cockpit.tsx'), 'utf8');

  it('alışkanlık işaretleme SEÇİLİ güne yazılır — bugüne değil', () => {
    expect(COCKPIT).toContain('toggleDate(id, selectedDay)');
    expect(COCKPIT).not.toContain('toggleDate(id, todayKey)');
    expect(COCKPIT).toContain('toggleSkipDate(id, selectedDay)');
  });

  it('GELECEK bir gün işaretlenemez', () => {
    expect(COCKPIT).toMatch(/if \(isFutureDay\)[\s\S]{0,200}return;/);
  });

  it('bugün dışında tamamlananlar da listede kalır — düzeltilebilsin', () => {
    expect(COCKPIT).toContain('if (!isSelectedToday) return true;');
  });

  it('satıra dokunmak artık menü açar; onay düğmesinde gizli jest yok', () => {
    const row = COCKPIT.slice(COCKPIT.indexOf('<SwipeableHabitItem'), COCKPIT.indexOf('</SwipeableHabitItem>'));
    expect(row).toContain('onPress={() => handleLongPressHabit(habit.id, habit.name)}');
    expect(row).not.toContain('toggleHabitExpand');
    // Onay düğmesinin uzun basışı (mola) kalktı: kaydırma ve menü zaten yapıyor.
    expect(row).not.toMatch(/onPress=\{\(\) => handleToggleHabit\(habit\.id\)\}\s*onLongPress/);
  });

  it('haftanın özeti alışkanlıkların ÜSTÜNDE', () => {
    expect(COCKPIT.indexOf('── BU HAFTA')).toBeLessThan(COCKPIT.indexOf('── HABITS ──'));
  });

  it('şerit noktası görevi DE alışkanlığı DA sayar', () => {
    expect(COCKPIT).toContain('habitsExpected');
    expect(COCKPIT).toMatch(/total: taskTotal \+ habitsExpected/);
    expect(COCKPIT).toMatch(/completed: taskDone \+ habitsDone/);
  });

  it('başlıkta iki KALICI hedef: solda Bugün ekranı, sağda geri bakış', () => {
    /*
      Sol yuvada önce "bugüne dön" vardı ve bugün seçiliyken soluk duruyordu; ekrana her
      girişte seçim bugüne döndüğü için pratikte HEP soluk görünüyordu — kullanıcı onu
      bozuk sandı. Kalıcı yuva kalıcı bir işe ait olmalı.
    */
    const header = COCKPIT.slice(COCKPIT.indexOf('<ScreenHeader'), COCKPIT.indexOf('<View style={{ flex: 1 }}>'));
    expect(header).toContain("router.push('/gun')");
    expect(header).toContain("router.push('/report')");
    expect(header).not.toContain('disabled={isSelectedToday}');
  });

  it('"bugüne dön" gün seçiminin yapıldığı yerde ve yalnız gerektiğinde', () => {
    const strip = COCKPIT.slice(COCKPIT.indexOf("'BU HAFTA'"), COCKPIT.indexOf('styles.weekRow'));
    expect(strip).toContain('{!isSelectedToday && (');
    expect(strip).toContain('setSelectedDay(todayKey)');
  });
});
