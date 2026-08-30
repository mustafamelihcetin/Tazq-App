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
    expect(HOME).toContain('{!isLite && (');
    const idx = HOME.indexOf('<MomentumPulse');
    const gate = HOME.lastIndexOf('{!isLite && (', idx);
    expect(gate).toBeGreaterThan(-1);
    // Kapı ile bileşen arasında başka bir kart girmemiş olmalı
    expect(idx - gate).toBeLessThan(200);
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
  it('konfeti çağrılarının hepsi kapıdan geçer', () => {
    const calls = [...HOME.matchAll(/useConfettiStore\.getState\(\)\.trigger\(/g)];
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      const before = HOME.slice(Math.max(0, c.index! - 120), c.index!);
      expect(before).toContain('!isLite');
    }
  });

  it('gün tamamlama kutlaması Sade modda açılmaz', () => {
    expect(HOME).toContain('if (isLite) return;');
  });

  it('PUAN ve ilk-başarı kaydı yine işlenir — mod veriyi budamaz', () => {
    // Sade mod bir GÖRÜNÜM tercihi: moddan çıkan kullanıcının geçmişi eksik olmamalı
    expect(HOME).toContain('prefsState.markFirstWin()');
    expect(HOME).toContain('addFocusPoints(10)');
    expect(HOME).toContain('addFocusPoints(25)');
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

  it('gizlediği üç şeyi tek tek sayıyor', () => {
    expect(SETTINGS).toContain('İvme skorunu, kutlamaları ve modları gizler');
    expect(SETTINGS).toContain('Hides momentum score, celebrations & modes');
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
