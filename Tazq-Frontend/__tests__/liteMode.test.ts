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
import { hiddenByGoalPause, isHiddenInLite } from '@/features/modes/utils/liteScope';
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

const HOME = stripComments((read('app/index.tsx') + read('features/dashboard/hooks/useHomeModel.tsx')));

/**
 * KUTLAMA TETİKLEYEN HER EKRAN — yalnız ana ekran değil.
 *
 * Bu dosya bir süre SADECE ana ekranı tarıyordu ve bu bir kör nokta üretti: Aksiyon
 * Merkezi konfetiyi doğrudan tetiklemeye devam ediyordu, üstelik hiçbir Sade mod
 * kapısı olmadan. Yani kullanıcı modu kapatıyor, görevlerini EN ÇOK tamamladığı
 * ekranda konfeti almaya devam ediyordu — testler yeşil yanarak.
 *
 * Kural artık kutlama tetikleyebilecek her ekranı kapsıyor. Yeni bir ekran kutlama
 * yapacaksa buraya eklenmeli; eklenmezse de aşağıdaki "doğrudan tetikleyen kimse
 * kalmadı" kuralı onu yakalar.
 */
const CELEBRATING_SCREENS: [string, string][] = [
  ['app/index.tsx', HOME],
  ['app/tasks.tsx', stripComments(read('app/tasks.tsx'))],
];

describe('ana ekran — oyunlaştırma gizlenir', () => {
  it('tek bir okunur yüklem var', () => {
    expect(HOME).toContain("const isLite = uiMode === 'lite'");
  });

  it('ivme skoru Sade modda çizilmez', () => {
    /*
      Skor artık "Bugün" özetinin içinde (TodayRings footer) ve TEK yerde çiziliyor.
      Kapı o yuvanın başında: Sade modda footer `null`, skor hiç çizilmez.
    */
    expect((HOME.match(/<MomentumPulse/g) ?? [])).toHaveLength(1);
    // 2026-10-31: footer memo'lu bir değişkende (todayFooter) — kapı aynı, yeri değişti.
    expect(HOME).toContain('footer={todayFooter}');
    const gate = HOME.indexOf('const todayFooter = React.useMemo(() => (!isLite ? (');
    expect(gate).toBeGreaterThan(-1);
    const idx = HOME.indexOf('<MomentumPulse');
    expect(idx).toBeGreaterThan(gate);
    expect(HOME.slice(gate, idx)).not.toMatch(/<(BentoCard|TodayRings)/);
  });

  it('çift dokunma tezahüratı Sade modda tetiklenmez', () => {
    expect(HOME).toContain('captionHighlight={!isLite && todayHighlight}');
    expect(HOME).toContain('if (!isLite && todayHighlight) return todaySurprise;');
  });

  it('ana sayfa yalnız yapılacaklar: halka, alışkanlık, ödeme ve alt bölümler yok (2026-11-06)', () => {
    expect(HOME).toContain('{!isLite && <TodayRings');
    // Ödeme kartı yalnız bugün/gecikmişse görünür: kaçırmanın bedeli gerçek, Sade modda da kalır.
    expect(HOME).toContain('<PaymentsSummaryCard />');
    expect(HOME).toContain('{!isLite && <><TourTarget id="habits"');
    expect(HOME).toContain('{!demoActive && !isLite && (');
    expect(HOME).toContain('saveTheDay={!isLite && zen.saveTheDayHint');
  });
});

describe('kutlamalar susturulur', () => {
  const CELEBRATE = read('features/user/utils/celebrate.ts');

  it('kutlama kararı TEK yerde — dört kopya birleşti', () => {
    /*
      Karar ana ekranda üç ayrı yere kopyalanmıştı (ilk görev · günün son görevi ·
      günün son alışkanlığı). DÖRDÜNCÜ kopya Aksiyon Merkezi'ndeydi ve o birleştirmenin
      dışında kalmıştı — bu test yalnız ana ekranı taradığı için görmedi.
    */
    for (const [name, src] of CELEBRATING_SCREENS) {
      expect(`${name}: ${src.includes('useConfettiStore')}`).toBe(`${name}: false`);
    }
    const calls = [...HOME.matchAll(/celebrate\(\{ kind: '([a-z-]+)'/g)].map(m => m[1]);
    expect(calls.sort()).toEqual(['day-cleared', 'first-win', 'habits-cleared']);
  });

  it('her çağrı Sade mod bayrağını GEÇİRİR', () => {
    for (const [name, src] of CELEBRATING_SCREENS) {
      const calls = [...src.matchAll(/celebrate\(\{[^}]*\}\)/g)];
      expect(`${name}: ${calls.length > 0}`).toBe(`${name}: true`);
      for (const m of calls) expect(`${name}: ${m[0].includes('isLite')}`).toBe(`${name}: true`);
    }
  });

  it('konfetiyi DOĞRUDAN tetikleyen ekran kalmadı', () => {
    /*
      Yukarıdaki liste elle tutuluyor ve bayatlayabilir. Bu kural listeye bakmıyor:
      `celebrate` dışında konfetiye dokunan HİÇBİR ekran olmamalı.
    */
    const walk = (dir: string): string[] =>
      fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
        if (['node_modules', '.expo', 'android', 'ios', 'dist', '.git'].includes(e.name)) return [];
        const rel = `${dir}/${e.name}`;
        return e.isDirectory() ? walk(rel) : /\.tsx$/.test(e.name) ? [rel] : [];
      });
    const offenders = ['app', 'features', 'shared']
      .flatMap(walk)
      .filter((f) => stripComments(read(f)).includes('useConfettiStore.getState().trigger'));
    expect(offenders).toEqual([]);
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
  /*
    2026-10-25: eski tur adımları BAŞLIK listesiyle filtreliyordu ("İvme Skorun" Sade
    modda gizlensin). Yeni tur gerçek öğeyi vurguluyor: hedefi ekranda olmayan adım
    YAPISAL olarak atlanır — liste tutmaya gerek kalmadı, unutulamaz.
  */
  it('hedefi ölçülemeyen adım atlanır', () => {
    const src = read('features/onboarding/components/SpotlightTour.tsx');
    expect(src).toContain('if (!rect) {');
    expect(src).toMatch(/setShown\(\(prev\) => prev\.map\(\(v, k\) => \(k === i \? false : v\)\)\)/);
  });

  it('Haftalık göstergesi kalktı (2026-11-01): başlıkta tur hedefi "cockpit" yok, yerinde gelen kutusu', () => {
    const src = (read('app/index.tsx') + read('features/dashboard/hooks/useHomeModel.tsx'));
    expect(src).not.toContain('<TourTarget id="cockpit"');
    expect(src).toContain('<InboxButton');
  });
});

describe('ayar metni yaptığı işi anlatır', () => {
  const SETTINGS = read('app/settings.tsx') + read('shared/constants/settingsCopy.ts');

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
    expect(SETTINGS).toContain('Yalnız yapılacaklar ve Odak. Değiştirince uygulama yeniden başlar');
    expect(SETTINGS).toContain('Just your to-dos and Focus. The app restarts when you change this');
    expect(read('features/modes/components/ModeTodayCard.tsx')).toContain('if (bare && lite) return null');
    expect(read('app/profile.tsx')).toContain("lite={uiMode === 'lite'}");
  });

  it('kapsam dışı sayfaların başka yolu yok: sadelik, yolu taşımak değil', () => {
    const profile = read('app/profile.tsx');
    expect(profile).not.toContain("router.push('/cockpit')");
    expect(profile).not.toContain("router.push('/modlar')");
    expect(read('features/dashboard/components/CommandPortal.tsx')).toContain("uiMode === 'lite' ? [] : [{");
    expect(read('app/index.tsx')).toContain('...(isLite ? [] : [{ Icon: Rocket');
    expect(read('app/tasks.tsx')).toContain("usePrefsStore.getState().uiMode !== 'lite' && (");
    expect(read('features/dashboard/hooks/useHomeModel.tsx')).toContain('payments: isLite ? [] : payments');
  });

  it('bildirimle gelinse de açılmaz, ana sayfaya döner; tam modda hepsi açık', () => {
    for (const r of ['cockpit', 'modlar', 'mod-ozet', 'plan', 'achievements', 'report', 'gun', 'rota', 'takvim', 'aliskanlik']) expect(isHiddenInLite(r)).toBe(true);
    for (const r of ['index', 'tasks', 'focus', 'nefes', 'archive', 'odemeler', 'profile', 'settings', undefined]) expect(isHiddenInLite(r)).toBe(false);
    expect(read('app/_layout.tsx')).toContain('useLiteRouteGuard(segments[0], router)');
    expect(read('features/dashboard/hooks/useHomeModel.tsx')).toContain('weeklyNotification && !isLite');
  });

  it('Profil yalnız kimlik ve tek çıkış: sayı ve sağlık yok', () => {
    const profile = read('app/profile.tsx');
    expect(profile).toContain('<LiteModeCard');
    expect(read('features/user/components/ProgressCard.tsx')).toContain("{lite ? null : statsState === 'loading'");
  });

  it('hedef duraklatılınca motor çalışmaz, plan görevi listede görünmez ama silinmez', () => {
    const on = { uiMode: 'lite', liteGoalsPaused: true };
    expect(hiddenByGoalPause({ tags: ['exam'] }, on)).toBe(true);
    expect(hiddenByGoalPause({ tags: ['iş'] }, on)).toBe(false);
    expect(hiddenByGoalPause({ tags: ['exam'] }, { uiMode: 'lite', liteGoalsPaused: false })).toBe(false);
    expect(hiddenByGoalPause({ tags: ['exam'] }, { uiMode: 'pro', liteGoalsPaused: true })).toBe(false);
    expect(read('features/modes/hooks/usePlanAdaptations.ts')).toContain("p.uiMode === 'lite' && p.liteGoalsPaused) return;");
  });

  it('açılış sade: yalnız TAZQ', () => {
    expect(read('shared/components/AnimatedSplash.tsx')).toContain('s.enabled && !s.plain');
    expect(read('features/modes/hooks/useLiteRouteGuard.ts')).toContain('setPlain(lite)');
  });

  it('anahtar modu doğrudan değiştirmez: önce onay, sonra temiz başlangıç', () => {
    const settings = read('app/settings.tsx');
    expect(settings).toContain("confirmUiMode(v ? 'lite' : 'pro'");
    expect(settings).not.toContain("setUiMode(v ? 'lite' : 'pro')");
  });
});

describe('sekme çubuğu', () => {
  it('Sade modda yalnız home/tasks/focus', () => {
    const nav = read('shared/components/BottomNavBar.tsx');
    expect(nav).toContain("LITE_TAB_IDS = ['home', 'tasks', 'focus']");
  });
});
