/**
 * SADE MOD — söylediğini yapar.
 *
 * ÖLÇÜLEN SORUN: ayar "Oyunlaştırma ve modları gizler — sadece görevler" diyordu ama
 * ana ekranda `uiMode` YALNIZ iki başarım kapısında kullanılıyordu. Ekranın en
 * tepesindeki İVME SKORU (0-100, renk bandı, haftalık fark) Sade modda da duruyordu;
 * MomentumPulse'ın kendi `isLite` kontrolü sadece sayma ANİMASYONUNU kapatıyordu.
 * Gerçekte kaybolan tek şey Haftalık ve Modlar sekmeleriydi.
 *
 * Skorlanmaktan kaçmak için düğmeyi açan kullanıcı skorlanmaya devam ediyordu.
 * Bir ayar söylediğini yapmıyorsa, ayarın kendisi bir hatadır.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

const HOME = stripComments(read('app/index.tsx'));

describe('ana ekran — oyunlaştırma gizlenir', () => {
  it('tek bir okunur yüklem var', () => {
    expect(HOME).toContain("const isLite = uiMode === 'lite'");
  });

  it('ivme skoru Sade modda çizilmez', () => {
    /*
      Skor satırı artık TEK yerde tanımlı bir değişken (momentumRow) ve konumu duruma
      göre değişiyor (bkz. dashboardZeroState.test.ts). Kapı da o tanımın başında:
      Sade modda değişken `null` olur, iki konumda da hiçbir şey çizilmez.
    */
    const def = HOME.indexOf('const momentumRow = !isLite ?');
    expect(def).toBeGreaterThan(-1);
    const idx = HOME.indexOf('<MomentumPulse');
    expect(idx).toBeGreaterThan(def);
    // Kapı ile bileşen arasında başka bir kart girmemiş olmalı
    expect(idx - def).toBeLessThan(200);
    // Tek tanım: ikinci bir çizim yolu açılmamalı.
    expect((HOME.match(/<MomentumPulse/g) ?? [])).toHaveLength(1);
  });

  it('durum merkezi düğmesi Sade modda gizli', () => {
    expect(HOME).toMatch(/isLite \? undefined : \(/);
  });

  it('çift dokunma tezahüratı Sade modda tetiklenmez', () => {
    expect(HOME).toContain('highlight={!isLite && todayHighlight}');
  });

  it('günlük ilerleme KALIR — işin durumu oyun değil', () => {
    // TodayCard koşulsuz çiziliyor: halka ve sayı Sade modda da görünür
    expect(HOME).toContain('<TodayCard');
    expect(HOME).not.toMatch(/!isLite && \(\s*<TodayCard/);
  });
});

describe('kutlamalar susturulur', () => {
  const CELEBRATE = read('features/user/utils/celebrate.ts');

  it('kutlama kararı TEK yerde — üç kopya birleşti', () => {
    // Karar ana ekranda üç ayrı yere kopyalanmıştı (ilk görev · günün son görevi ·
    // günün son alışkanlığı) ve Sade mod kapısı üçüne ayrı ayrı yazılmak zorundaydı.
    expect(HOME).not.toContain('useConfettiStore');
    const calls = [...HOME.matchAll(/celebrate\(\{ kind: '([a-z-]+)'/g)].map(m => m[1]);
    expect(calls.sort()).toEqual(['day-cleared', 'first-win', 'habits-cleared']);
  });

  it('her çağrı Sade mod bayrağını GEÇİRİR', () => {
    for (const m of HOME.matchAll(/celebrate\(\{[^}]*\}\)/g)) {
      expect(m[0]).toContain('isLite');
    }
  });

  it('konfeti YALNIZ Sade mod dışında açılır', () => {
    const idx = CELEBRATE.indexOf('useConfettiStore.getState().trigger');
    expect(idx).toBeGreaterThan(-1);
    expect(CELEBRATE.slice(Math.max(0, idx - 60), idx)).toContain('if (!isLite)');
  });

  it('gün tamamlama kutlaması Sade modda açılmaz', () => {
    expect(HOME).toContain('if (isLite) return;');
  });

  it('PUAN ve ilk-başarı kaydı KAPININ DIŞINDA — mod veriyi budamaz', () => {
    // Sade mod bir GÖRÜNÜM tercihi: moddan çıkan kullanıcının geçmişi eksik olmamalı.
    const gate = CELEBRATE.indexOf('if (!isLite)');
    expect(CELEBRATE.indexOf('markFirstWin()')).toBeGreaterThan(gate);
    expect(CELEBRATE.indexOf('addFocusPoints(spec.points)')).toBeGreaterThan(gate);
  });

  it('üç kutlamanın puanı korundu (10 / 25 / 20)', () => {
    expect(CELEBRATE).toMatch(/'first-win':[\s\S]*?points: 10/);
    expect(CELEBRATE).toMatch(/'day-cleared':[\s\S]*?points: 25/);
    expect(CELEBRATE).toMatch(/'habits-cleared':[\s\S]*?points: 20/);
  });
});

describe('tur gördüğü ekranı anlatır', () => {
  it('Sade modda ivme adımı atlanır', () => {
    const src = read('features/onboarding/components/HelpTourModal.tsx');
    expect(src).toContain("uiMode === 'lite'");
    expect(src).toContain('GAMIFIED_STEP_TITLES');
  });

  it('atlanan adım gerçekten var olan bir adım — filtre boşa düşmesin', () => {
    const src = read('features/onboarding/components/HelpTourModal.tsx');
    expect(src).toContain("title: { tr: 'İvme Skorun', en: 'Your Momentum' }");
  });
});

describe('ayar metni yaptığı işi anlatır', () => {
  const SETTINGS = read('app/settings.tsx');

  it('artık "sadece görevler" demiyor — TodayCard ve görev akışı duruyor', () => {
    expect(SETTINGS).not.toContain('sadece görevler');
    expect(SETTINGS).not.toContain('tasks only');
  });

  it('gizlediği HER ŞEYİ sayıyor — Haftalık dahil', () => {
    /*
      Etiket "İvme skorunu, kutlamaları ve modları gizler" diyordu ama Sade mod sekme
      setini de daraltıyor: Modlar VE Haftalık birlikte kayboluyor (bkz. BottomNavBar
      → LITE_TAB_IDS). Haftalık Merkez'in sessizce kaybolması sürpriz oluyordu; bir
      ayarın altyazısı yaptığı işin TAMAMINI saymak zorunda.
    */
    expect(SETTINGS).toContain('İvme skorunu, kutlamaları, Modlar ve Haftalık sekmelerini gizler');
    expect(SETTINGS).toContain('Hides momentum, celebrations, Modes & Weekly tabs');
  });

  it('Haftalık Merkez Sade modda erişilebilir kalıyor', () => {
    // Durum merkezi düğmesi gizlendiği için bu satır TEK erişim yolu
    expect(SETTINGS).toContain("uiMode === 'lite' && (");
    expect(SETTINGS).toContain("'Haftalık Merkez'");
  });
});

describe('sekme çubuğu', () => {
  it('Sade modda yalnız home/tasks/focus', () => {
    const nav = read('shared/components/BottomNavBar.tsx');
    expect(nav).toContain("LITE_TAB_IDS = ['home', 'tasks', 'focus']");
  });
});
