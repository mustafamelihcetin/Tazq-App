import fs from 'fs';
import path from 'path';

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

  it('üç ekran da ORTAK kapıları kullanıyor', () => {
    for (const [name, src] of FIRST_RUN_SCREENS) {
      expect(`${name}: ${src.includes('useDemoGate(')}`).toBe(`${name}: true`);
      expect(`${name}: ${src.includes('useTourGate(')}`).toBe(`${name}: true`);
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

describe('örnek veri gerçek veriyi gizleyemez', () => {
  it('kapı GERÇEK SAYIYI parametre olarak istiyor', () => {
    /*
      "Gerçek veri varsa gösterme" kuralı çağıranın hatırlamasına bırakılamaz — imzanın
      kendisinden gelmeli. Koşulda bu yokken kullanıcının eklediği ilk görev listede
      görünmüyordu: dal erken dönüp yalnız sahte satırları veriyordu.
    */
    expect(FIRST_RUN).toMatch(/\(realCount: number\) =>[\s\S]{0,120}realCount === 0/);
  });

  it('tercihler DİSKTEN okunmadan örnek veri çizilmiyor', () => {
    /*
      `onboardingCompleted` okunana kadar varsayılanı `false`. Bu kontrol olmadan HER
      kullanıcı, her soğuk açılışta, gerçek verisi yüklenene kadar sahte satırları
      görüyordu — kimsenin bildirmediği ama her açılışta olan bir parıltı.
    */
    expect(FIRST_RUN).toMatch(/hydrated && realCount === 0/);
  });

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
  it('karar odaklanma anında bir kez alınıyor', () => {
    expect(FIRST_RUN).toContain('useFocusEffect(');
    expect(FIRST_RUN).toMatch(/setAllowed\(read\.current\(\)\)/);
  });

  it('içerik REF üzerinden okunuyor — kapanışta eskiye saplanmasın', () => {
    expect(FIRST_RUN).toContain('read.current = hasContent;');
    for (const [name, src] of FIRST_RUN_SCREENS) {
      expect(`${name}: ${/useTourGate\(\(\) => \w+Ref\.current/.test(src)}`).toBe(`${name}: true`);
    }
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
