import fs from 'fs';
import path from 'path';

/**
 * TİTREŞİM DİLİ BEKÇİSİ.
 *
 * Ölçülen iki sorun vardı:
 *  1. YOĞUNLUK — 392 dokunma noktasına 296 titreşim (her 1.3 dokunmada bir).
 *     Apple'ın kendi uygulamalarında oran ~1/8–1/10. Sürekli titreşim bilgi
 *     taşımayı bırakır, gürültüye dönüşür.
 *  2. TUTARSIZLIK — aynı anlam farklı titreşiyordu:
 *       yıkıcı işlem → Light(7)·Medium(5)·selection(5)·Warning(4)·Heavy(3)·Success(1)
 *     Haptik bir dildir; aynı kelime altı telaffuzla söylenirse öğrenilemez.
 */

const ROOT = path.resolve(__dirname, '..');
const walk = (dir: string): string[] => {
  const skip = ['node_modules', '__tests__', '__mocks__', '.expo', 'android', 'ios', 'dist'];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (skip.includes(e.name)) return [];
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
};
const SRC = ['app', 'shared', 'features'].flatMap(d => walk(path.join(ROOT, d)));
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');
const read = (p: string) => fs.readFileSync(p, 'utf8');
/** Yorumlar hariç — gerekçe metninde eski API'den söz etmek serbest. */
const code = (p: string) => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
  .join('\n');

describe('tek dil — ekranlar expo-haptics çağırmaz', () => {
  it('ham expo-haptics kullanımı yok (yalnız haptics.ts)', () => {
    const offenders = SRC
      .filter(p => rel(p) !== 'shared/utils/haptics.ts')
      .filter(p => /Haptics\.\w+Async\(|HapticsOriginal/.test(code(p)))
      .map(rel);
    // Şiddet kararı TEK yerde verilmeli; ekran ne HİSSETTİRECEĞİNİ değil
    // ne OLDUĞUNU söyler.
    expect(offenders).toEqual([]);
  });

  it('yerel .catch() shim kopyaları geri gelmemeli', () => {
    // 11 dosya `const Haptics = { ... .catch(() => {}) }` şeklinde kendi
    // sarmalayıcısını yazmıştı — aynı iş 11 kez.
    const offenders = SRC.filter(p => /const Haptics = \{/.test(read(p))).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('anlam eşlemesi', () => {
  const api = read(path.join(ROOT, 'shared/utils/haptics.ts'));

  it('her anlam için TEK geri bildirim tanımlı', () => {
    for (const fn of ['select', 'surface', 'commit', 'success', 'error', 'destructive']) {
      expect(api).toContain(`${fn}: () =>`);
    }
  });

  it('yıkıcı işlem Warning kullanır — Success/Light değil', () => {
    expect(api).toMatch(/destructive: \(\)[^;]*Expo\.NotificationFeedbackType\.Warning/);
  });

  it('silme eylemleri yıkıcı titreşim kullanır', () => {
    // Eskiden `handleDelete` Medium impact ("işlem başladı") kullanıyordu;
    // geri alınamaz bir sonucu bildirmiyordu.
    for (const f of ['app/tasks.tsx', 'app/admin.tsx']) {
      const src = read(path.join(ROOT, f));
      const fn = src.match(/const handleDelete\s*=[\s\S]{0,300}/)?.[0] ?? '';
      expect({ file: f, ok: /haptic\.destructive\(\)/.test(fn) }).toEqual({ file: f, ok: true });
    }
  });
});

describe('kullanıcı tercihi', () => {
  const api = read(path.join(ROOT, 'shared/utils/haptics.ts'));

  it('titreşim kullanıcı tarafından kapatılabilir', () => {
    /**
     * Ses (`soundEffects`) kapatılabiliyordu ama titreşim kapatılamıyordu; oysa
     * ~293 çağrı var (her 1.4 dokunmada bir). Rahatsız olan kullanıcının çıkışı yoktu.
     * Kontrol TEK KAPIDA — merkezileştirmenin asıl kazancı bu.
     */
    expect(api).toContain('hapticFeedback');
    expect(api).toMatch(/function enabled\(\)/);
  });

  it('HER geri bildirim tercihi kontrol eder — biri atlanmasın', () => {
    for (const fn of ['select', 'surface', 'commit', 'success', 'error', 'destructive', 'celebrate']) {
      expect(api).toContain(`${fn}: () => { if (enabled())`);
    }
  });

  it('tercih okunamazsa varsayılan AÇIK — sessiz bozulma olmasın', () => {
    expect(api).toMatch(/catch \{[\s\S]{0,80}return true/);
  });

  it('ayarlar ekranında görünür bir anahtar var', () => {
    const st = read(path.join(ROOT, 'app/settings.tsx'));
    expect(st).toContain('setHapticFeedback');
    expect(st).toMatch(/'Titreşim' : 'Haptics'/);
  });
});

describe('yoğunluk', () => {
  it('saf gezinme titreşmez', () => {
    /**
     * iOS sekme/geri geçişlerinde titremez; gezinme zaten görsel olarak bellidir.
     *
     * YALNIZCA nötr geri bildirimler yasak. `success`/`error`/`destructive` bir
     * İŞLEMİN SONUCUNU bildirir ve ardından yönlendirme yapılması meşrudur
     * ("kayıt başarılı → ana sayfa"). Kural gezinmeyi değil, gezinmenin KENDİSİNİ
     * olay sanmayı yasaklar.
     */
    const offenders: string[] = [];
    for (const p of SRC) {
      if (/haptic\.(select|surface|commit)\(\);\s*router\.(push|replace|back)\(/.test(code(p))) offenders.push(rel(p));
    }
    expect(offenders).toEqual([]);
  });

  it('titreşim sayısı dokunma sayısını geçmez ve tavanın altında kalır', () => {
    let press = 0, hap = 0;
    for (const p of SRC) {
      if (rel(p) === 'shared/utils/haptics.ts') continue;
      const src = read(p);
      press += (src.match(/onPress=/g) ?? []).length;
      hap += (src.match(/haptic\.\w+\(\)/g) ?? []).length;
    }
    expect(hap).toBeLessThan(press);
    /**
     * Borç tavanı. 296 → 291 (ölü gezinme titreşimleri) → 293: "Geri al" özelliği
     * iki MEŞRU titreşim ekledi (yıkıcı işlem bildirimi + geri alma başarısı).
     * → 297: günü tamamlama kutlaması (1) + admin AI testinin SONUÇ bildirimi (2:
     * başarı/hata, çalışma anında yalnız biri ateşlenir). Basma anındaki titreşim
     * bilinçli olarak EKLENMEDİ — düğme zaten soluklaşıp yazısını değiştiriyor,
     * görülebilen bir şeyi titretmek gürültüdür.
     * Bilinçli ve gerekçeli yükseltme; kural hâlâ "yeni titreşim eklerken düşün".
     *
     * DÜRÜST NOT: hedef oran ~1/3, bugünkü ölçüm ~1/1.4. Yani yoğunluk HÂLÂ YÜKSEK.
     * Bunu düşürmek 50+ çağrı yerinde tek tek "bu titreşim ne anlatıyor?" sorusunu
     * yanıtlamayı gerektirir — ayrı ve bilinçli bir tur işi.
     */
    expect(hap).toBeLessThanOrEqual(297);
  });
});
