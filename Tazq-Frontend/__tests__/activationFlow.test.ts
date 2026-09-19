import { renderHook, act } from '@testing-library/react-native';
import { useDemoGate, useTourGate } from '@/features/onboarding/utils/firstRun';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import fs from 'fs';
import path from 'path';

// firstRun, tur kapısı için expo-router'dan useFocusEffect alıyor; burada yalnız örnek
// veri kapısı ölçülüyor, yönlendirici gerekmiyor.
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return { useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]) };
});

/**
 * İLK KULLANIM AKIŞI — hoş geldin, örnek veri, tur.
 *
 * ── NEDEN VAR ─────────────────────────────────────────────────────────────────
 * Bu akışı yalnız YENİ bir hesabın ilk dakikası tetikliyor; günlük kullanımda buraya
 * hiç düşülmüyor. Sonuç: beş ayrı kusur canlıya kadar gitti ve hepsini kullanıcı
 * bildirdi. Beşi de aynı kök sebepten türüyordu — aynı iki karar (örnek veri ne zaman
 * görünür, tur ne zaman açılır) üç ekranda ÜÇ AYRI şekilde yazılmıştı.
 *
 * Bu dosya artık tek tek kusurları değil, KURALIN TEK YERDE kaldığını bekliyor.
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
/** Yorumları eler — bir kuralı ANLATAN not, kuralın ihlali sayılmasın. */
const stripComments = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');

const FIRST_RUN = stripComments(read('features/onboarding/utils/firstRun.ts'));
const PREFS = stripComments(read('features/modes/store/usePrefsStore.ts'));
const REGISTER = stripComments(read('app/register.tsx'));
const LOGIN = stripComments(read('app/login.tsx'));

/** Örnek veri ve tur taşıyan her ekran. Yeni bir ekran eklenirse buraya da eklenmeli. */
const FIRST_RUN_SCREENS: [string, string][] = [
  ['app/index.tsx', stripComments(read('app/index.tsx'))],
  ['app/tasks.tsx', stripComments(read('app/tasks.tsx'))],
  ['app/cockpit.tsx', stripComments(read('app/cockpit.tsx'))],
];

describe('kural TEK yerde', () => {
  it('hiçbir ekran örnek veri koşulunu ELLE yazmıyor', () => {
    /*
      Elle yazılan koşul ayrışır: üç ekranda üç farklı davranış çıkmıştı. Kapılar tek
      modülde (firstRun); ekranlar yalnız çağırır.
    */
    const offenders = FIRST_RUN_SCREENS.filter(([, src]) =>
      /completedTours\?\.\w+ !== true && !onboardingCompleted/.test(src),
    ).map(([f]) => f);
    expect(offenders).toEqual([]);
  });

  it('örnek veri taşıyan üç ekran ORTAK kapıları kullanıyor', () => {
    for (const [name, src] of FIRST_RUN_SCREENS) {
      expect(`${name}: ${src.includes('useDemoGate(')}`).toBe(`${name}: true`);
      expect(`${name}: ${src.includes('useTourGate(')}`).toBe(`${name}: true`);
    }
  });

  it('turu olan HER ekran ortak tur kapısından geçer — odak ekranı dahil', () => {
    // Odak turunda hiç kapı yoktu: ekran arka plandayken de açılabiliyordu.
    for (const f of ['app/index.tsx', 'app/tasks.tsx', 'app/cockpit.tsx', 'app/modlar.tsx', 'app/focus.tsx']) {
      const src = stripComments(read(f));
      expect(`${f}: ${/useTourGate\('\w+'/.test(src)}`).toBe(`${f}: true`);
      expect(`${f}: ${/\{tourOn && \(?\s*<HelpTourModal/.test(src)}`).toBe(`${f}: true`);
    }
  });

  it('turun görünürlüğü hiçbir ekranda listeye DOĞRUDAN bağlı değil', () => {
    // `tasks.length > 0 && <HelpTourModal/>` reaktiftir: dizi dolduğu karede açılır.
    const offenders = FIRST_RUN_SCREENS.filter(([, src]) =>
      /\.length > 0[^\n]*\n?\s*<HelpTourModal/.test(src),
    ).map(([f]) => f);
    expect(offenders).toEqual([]);
  });
});

describe('ilk kullanım senaryosu — tur ve örnek veri BİRLİKTE', () => {
  const reset = (over: Record<string, unknown> = {}) =>
    usePrefsStore.setState({ _hasHydrated: true, completedTours: {}, ...over } as never);

  beforeEach(() => reset());

  it('tur sayfaya İLK girişte açılır — içerik şartı YOK', () => {
    /*
      Eskiden ana sayfa, Görevler ve Kokpit turu ancak ilk görevden SONRA açılıyordu;
      yeni kullanıcı ilk ziyarette tur görmüyordu.
    */
    const { result } = renderHook(() => useTourGate('tasks'));
    expect(result.current).toBe(true);
  });

  it('tur bekletilebilir — ana sayfada hoş geldin ekranı bitene kadar', () => {
    const { result } = renderHook(() => useTourGate('dashboard', true));
    expect(result.current).toBe(false);
  });

  it('tamamlanan tur bir daha açılmaz; tercihler okunmadan da açılmaz', () => {
    reset({ completedTours: { tasks: true } });
    expect(renderHook(() => useTourGate('tasks')).result.current).toBe(false);
    reset({ _hasHydrated: false });
    expect(renderHook(() => useTourGate('tasks')).result.current).toBe(false);
  });

  it('örnek veri YALNIZ tur açıkken ve gerçek veri yokken', () => {
    const on = renderHook(() => useDemoGate('dashboard', true)).result.current;
    expect(on(0)).toBe(true);
    expect(on(3)).toBe(false); // gerçek veri varsa asla
    const off = renderHook(() => useDemoGate('dashboard', false)).result.current;
    expect(off(0)).toBe(false); // tur yoksa örnek yok
  });

  it('tur BİTİNCE örnek veri aynı anda kaybolur', () => {
    const { result, rerender } = renderHook(() => {
      const tourOn = useTourGate('tasks');
      return useDemoGate('tasks', tourOn)(0);
    });
    expect(result.current).toBe(true);
    act(() => usePrefsStore.getState().setTourCompleted('tasks', true));
    rerender({});
    expect(result.current).toBe(false);
  });
});

describe('örnek veri gerçek veriyi gizleyemez', () => {
  it('her çağrı gerçek koleksiyonun uzunluğunu veriyor — sabit değil', () => {
    for (const [name, src] of FIRST_RUN_SCREENS) {
      const calls = [...src.matchAll(/demoGate\(([^)]*)\)/g)].map((m) => m[1].trim());
      expect(`${name}: ${calls.length > 0}`).toBe(`${name}: true`);
      for (const arg of calls) {
        expect(`${name} → demoGate(${arg})`).toMatch(/\.length\)?$/);
      }
    }
  });
});

describe('tur kullanıcının eylemine tepki olarak açılmaz', () => {
  it('kapının içerik parametresi YOK — görev eklemek turu tetikleyemez', () => {
    expect(FIRST_RUN).not.toContain('hasContent');
    expect(FIRST_RUN).toContain('useFocusEffect(');
  });
});

describe('hoş geldin ile tur SENKRON', () => {
  const INDEX = stripComments(read('app/index.tsx'));
  const LAYOUT = stripComments(read('app/_layout.tsx'));

  it('ana sayfa turu hoş geldin görünür ya da beklemedeyken AÇILMAZ', () => {
    expect(INDEX).toContain("useTourGate('dashboard', profileSetupVisible || welcomeStatus === 'pending')");
  });

  it('hoş geldin turu ZORLA sıfırlamaz — misafirken görülen tur ikinci kez gelmez', () => {
    expect(INDEX).not.toContain("setTourCompleted('dashboard', false)");
  });

  it('bildirim izni hoş geldin ve ana sayfa turundan SONRA sorulur', () => {
    expect(LAYOUT).toContain("welcomeStatus !== 'pending'");
    expect(LAYOUT).toContain('completedTours?.dashboard === true');
  });
});

describe('hoş geldin ekranı: oturuma değil DİSKE yazılı', () => {
  it('kendi kalıcı bayrağı var ve GERÇEKTEN diske yazılıyor', () => {
    /*
      Eski kapı `onboardingCompleted === false && isFirstLogin` idi ve ikisi de yanlıştı:
       · `onboardingCompleted` TANITIM SLAYTLARI bitince de true oluyor; temiz kurulumda
         sıra slaytlar → kayıt olduğu için ekran hiç ulaşılamıyordu.
       · `isFirstLogin` persist edilmiyor; uygulama kapanınca kayboluyordu.

      "Kalıcı" iddiası DOĞRULANMALI, varsayılmamalı: mağazada `partialize` olmadığı için
      state'in tamamı diske yazılıyor. Biri `partialize` eklerse bu bayrak sessizce
      uçucu hâle gelir ve hoş geldin ekranı yine uygulama kapanınca kaybolur — o yüzden
      test burada bir de partialize'ın YOKLUĞUNU bekliyor.
    */
    expect(PREFS).toContain("welcomeStatus: 'unknown' | 'pending' | 'done';");
    expect(PREFS).not.toContain('partialize');
  });

  it('cihazlar arasında taşınıyor — ikinci cihazda tekrar sorulmuyor', () => {
    /*
      Bayrak bulut listesinde: telefonda tamamlayan kullanıcı tablette aynı ekranla
      karşılaşmıyor. Buluttan geri yükleme, anahtar buluttaki kopyada YOKSA yerel değere
      dokunmuyor (bkz. hydrateFromCloud → `parsed[key] === undefined` → continue), yani
      eski kullanıcılara geriye dönük bir ekran açılmıyor.
    */
    const cloudList = PREFS.slice(PREFS.indexOf('CLOUD_PREF_KEYS'), PREFS.indexOf('] as const'));
    expect(cloudList).toContain("'welcomeStatus'");
    expect(PREFS).toContain('if (!prefsJson) return;');
    expect(PREFS).toContain('if (parsed[key] === undefined) continue;');
  });

  it('ilk giriş bayrağı ekranı AÇMIYOR, yalnız kalıcı durumu kuruyor', () => {
    const INDEX = stripComments(read('app/index.tsx'));
    expect(INDEX).toMatch(/if \(isFirstLogin && welcomeStatus === 'unknown'\)/);
    expect(INDEX).toMatch(/if \(welcomeStatus === 'pending'/);
    // Slaytların yazdığı bayrak artık kapıda DEĞİL.
    expect(INDEX).not.toMatch(/onboardingCompleted === false && isFirstLogin/);
  });

  it('bayrak yalnız ekran tamamlanınca kapanıyor', () => {
    const INDEX = stripComments(read('app/index.tsx'));
    expect(INDEX).toContain("setWelcomeStatus('done')");
  });

  it('mevcut kullanıcılara geriye dönük açılmıyor', () => {
    // Varsayılan 'unknown'; 'pending'e yalnız ilk girişte geçiliyor.
    expect(PREFS).toContain("welcomeStatus: 'unknown',");
  });
});

describe('ilk giriş bayrağı her yoldan taşınıyor', () => {
  /*
    Hesap YARATABİLEN her yol, sunucudan gelen `isNewUser`ı `setAuth`e vermek zorunda.
    register.tsx'in sosyal yolları bunu unutmuştu: Google/Apple ile kayıt olan kullanıcı
    hoş geldin akışını hiç görmüyordu ve bu sessizce oluyordu.
  */
  const entryPoints: [string, string][] = [
    ['register.tsx', REGISTER],
    ['login.tsx', LOGIN],
  ];

  it('sosyal yollar isNewUser\'ı OKUYOR', () => {
    for (const [name, src] of entryPoints) {
      const calls = [...src.matchAll(/await AuthService\.(googleLogin|appleLogin)\(/g)];
      const reads = [...src.matchAll(/const \{[^}]*isNewUser[^}]*\} = await AuthService\.(googleLogin|appleLogin)\(/g)];
      expect(`${name}: ${reads.length}/${calls.length}`).toBe(`${name}: ${calls.length}/${calls.length}`);
    }
  });

  it('okunan bayrak setAuth\'a GEÇİRİLİYOR — okumak tek başına yetmez', () => {
    for (const [name, src] of entryPoints) {
      const passed = [...src.matchAll(/setAuth\([^)]*,\s*isNewUser\s*\)/g)];
      expect(`${name}: ${passed.length >= 2}`).toBe(`${name}: true`);
    }
  });

  it('e-posta ile KAYIT da ilk giriş sayılıyor', () => {
    expect(REGISTER).toMatch(/setAuth\([^)]*,\s*true\)/);
  });
});
