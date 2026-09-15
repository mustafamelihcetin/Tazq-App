import fs from 'fs';
import path from 'path';

/**
 * İLK KULLANIM AKIŞI — hoş geldin, demo veri, tur.
 *
 * ── NEDEN VAR ─────────────────────────────────────────────────────────────────
 * Bu akışı yalnız YENİ bir hesabın ilk dakikası tetikliyor; geliştirici günlük
 * kullanımda buraya hiç düşmüyor. Üç kusur da bu yüzden canlıya kadar gitti ve
 * hepsini kullanıcı bildirdi:
 *
 *   1. Demo veri GERÇEK görevleri gizliyordu — kullanıcı ilk görevini ekliyor,
 *      kaydediliyor ama listede görünmüyordu.
 *   2. Tur, kullanıcının EYLEMİNE tepki olarak açılıyordu: görev eklenir eklenmez
 *      modal önüne atlıyordu ("görev eklemek pop-up açtı" gibi okunuyordu).
 *   3. Google/Apple ile KAYIT olurken `isNewUser` taşınmıyordu; hoş geldin ekranı
 *      hiç açılmıyordu.
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

const TASKS = stripComments(read('app/tasks.tsx'));
const REGISTER = stripComments(read('app/register.tsx'));
const LOGIN = stripComments(read('app/login.tsx'));

describe('demo veri gerçek veriyi gizleyemez', () => {
  it('örnek satırlar YALNIZ liste gerçekten boşken', () => {
    /*
      Koşulda `tasks.length === 0` yokken dal erken dönüp SADECE demo satırları
      veriyordu: eklenen gerçek görev, tur bitene kadar görünmez kalıyordu. Bir
      uygulamanın en temel sözü, eklediğin şeyin orada durmasıdır.
    */
    expect(TASKS).toContain('if (tasks.length === 0 && completedTours?.tasks !== true && !onboardingCompleted)');
  });

  it('demo satırlar gerçek görevlerden AYIRT EDİLEBİLİR kalıyor', () => {
    // Sahte kimlikler gerçek id aralığının çok üstünde: bir demo satırı yanlışlıkla
    // sunucuya gönderilirse hemen fark edilir.
    for (const id of ['99991', '99992', '99993']) expect(TASKS).toContain(id);
  });
});

describe('tur kullanıcının eylemine tepki olarak açılmaz', () => {
  it('karar ekrana GİRİLİRKEN bir kez veriliyor', () => {
    /*
      `tasks.length > 0` doğrudan koşul olarak kullanılınca REAKTİF olur: dizi dolduğu
      karede modal açılır. Karar artık odaklanma anında donuyor.
    */
    expect(TASKS).toContain('useFocusEffect(useCallback(() => { setTourAllowed(tasksRef.current.length > 0); }, []))');
    expect(TASKS).toContain('{tourAllowed && (');
  });

  it('turun görünürlüğü artık doğrudan listeye bağlı DEĞİL', () => {
    expect(TASKS).not.toContain('{tasks.length > 0 && (\n        <HelpTourModal');
  });
});

describe('ilk giriş bayrağı her yoldan taşınıyor', () => {
  /*
    `isFirstLogin` hoş geldin (profil kurulumu) ekranının tek kapısı (bkz. app/index.tsx).
    Hesap YARATABİLEN her yol bayrağı sunucudan alıp `setAuth`e vermek zorunda; biri
    unutulursa o yoldan gelen kullanıcı akışı hiç görmez ve bu sessizce olur.
  */
  const entryPoints: [string, string][] = [
    ['register.tsx', REGISTER],
    ['login.tsx', LOGIN],
  ];

  it('sosyal giriş yolları sunucudan gelen isNewUser\'ı OKUYOR', () => {
    for (const [name, src] of entryPoints) {
      const social = [...src.matchAll(/await AuthService\.(googleLogin|appleLogin)\(/g)];
      expect(social.length).toBeGreaterThan(0);
      // Her sosyal çağrının dönüşünde isNewUser destructure edilmeli.
      const reads = [...src.matchAll(/const \{[^}]*isNewUser[^}]*\} = await AuthService\.(googleLogin|appleLogin)\(/g)];
      expect(`${name}: ${reads.length}`).toBe(`${name}: ${social.length}`);
    }
  });

  it('okunan bayrak setAuth\'a GEÇİRİLİYOR — okumak tek başına yetmez', () => {
    for (const [name, src] of entryPoints) {
      const passed = [...src.matchAll(/setAuth\([^)]*,\s*isNewUser\s*\)/g)];
      expect(`${name}: ${passed.length >= 2}`).toBe(`${name}: true`);
    }
  });

  it('e-posta ile KAYIT da ilk giriş sayılıyor', () => {
    // Sosyal yollardan farklı: burada yeni olduğunu zaten biliyoruz, sabit `true`.
    expect(REGISTER).toMatch(/setAuth\([^)]*,\s*true\)/);
  });
});
