/**
 * UYKU SENKRONU — "Geri al" YALNIZ bizim koyduğumuzu kaldırır.
 *
 * ÖLÇÜLEN SORUN: `processSleep` hedef tutunca koşulsuz 'marked' dönüyordu. Yazma
 * korumalıydı (`if (!alreadyDone) markDone(...)`) ama DÖNÜŞ değeri değildi; `run` o
 * id'yi "işaretledik" listesine ekliyor, toast'ın "Geri al" düğmesi de listedeki her
 * şeyi geri alıyordu. Kullanıcı sağlık verisi okunurken (gerçek bir HealthKit /
 * Health Connect turu, saniyeler sürebilir) alışkanlığı KENDİ işaretlemişse,
 * "Geri al" onun kendi işaretini siliyordu.
 *
 * Ayrıca: bildirim geriye-doldurmadan SONRA gösteriliyordu. Arada ikinci bir tam
 * platform sorgusu ve alışkanlık × 4 gün'lük döngü vardı; toast 4 sn sonra kendini
 * kapattığı için kullanıcı başka ekrana geçtikten sonra beliriyordu.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

const SRC = read('features/habits/hooks/useSleepHealthSync.ts');
const CODE = stripComments(SRC);

describe('sonuç türleri', () => {
  it("'already' AYRI bir sonuç — 'marked' ile karıştırılmaz", () => {
    expect(CODE).toMatch(/type SleepOutcome\s*=\s*'marked'\s*\|\s*'already'/);
  });

  it('zaten işaretliyse marked DÖNMEZ', () => {
    const fn = CODE.slice(CODE.indexOf('const processSleep'), CODE.indexOf('const announce'));
    expect(fn).toContain("return 'already'");
    // 'already' dönüşü, markDone çağrısından ÖNCE gelmeli
    expect(fn.indexOf("return 'already'")).toBeLessThan(fn.indexOf('markDone('));
  });
});

describe('geri alma kapsamı', () => {
  const runFn = CODE.slice(CODE.indexOf('const run = useCallback'), CODE.indexOf('useEffect(() => {'));

  it('geri alınabilir liste yalnız BU turda işaretlenenleri taşır', () => {
    expect(runFn).toContain('justMarked');
    expect(runFn).toMatch(/if \(outcome === 'marked'\) justMarked\.push/);
  });

  it("'already' hiçbir listeye girmez — ne geri alınır ne işaretlenir", () => {
    expect(runFn).not.toMatch(/'already'\s*\)\s*justMarked\.push/);
    expect(runFn).not.toMatch(/'already'\s*\)\s*pendingMark\.push/);
  });

  it("'info' ayrı listede — toast'ın İşaretle eylemi bunları hedefler", () => {
    expect(runFn).toMatch(/if \(outcome === 'info'\) pendingMark\.push/);
  });

  it('eski tek-liste deseni geri gelmedi', () => {
    expect(runFn).not.toMatch(/const marked: string\[\]/);
    expect(runFn).not.toMatch(/outcome !== 'nodata'.*marked\.push/s);
  });
});

describe('bildirim zamanlaması', () => {
  const runFn = CODE.slice(CODE.indexOf('const run = useCallback'), CODE.indexOf('useEffect(() => {'));

  it('geriye doldurma DÖNGÜSÜNDEN ÖNCE gösterilir', () => {
    /*
      Çapa DEĞİŞTİ, kural değil: geriye dolgu artık tarihi yeniden kurmuyor, `byDay`in
      kendi anahtarlarını geziyor (gerekçe: iki ayrı gün tanımı aynı diziye yazıyordu,
      bkz. useSleepHealthSync). Beklenen şey aynı — bildirim, dolgudan ÖNCE.
    */
    const announceIdx = runFn.indexOf('announce(outcomeOnce');
    const backfillIdx = runFn.indexOf('for (const [key, mins] of Object.entries(byDay))');
    expect(announceIdx).toBeGreaterThan(-1);
    expect(backfillIdx).toBeGreaterThan(-1);
    expect(announceIdx).toBeLessThan(backfillIdx);
  });

  it('tek bildirim — iki çağrı yok', () => {
    expect((runFn.match(/announce\(/g) ?? []).length).toBe(1);
  });
});

describe('platform okuması', () => {
  const runFn = CODE.slice(CODE.indexOf('const run = useCallback'), CODE.indexOf('useEffect(() => {'));

  it('TEK okuma — iki ayrı sorgu atılmaz', () => {
    expect(runFn).toContain('SleepHealth.getSleepSummary(');
    expect(runFn).not.toContain('getRecentSleepMinutes()');
    expect(runFn).not.toContain('getSleepMinutesByDay(');
  });

  it('iki cevap AYRI hesaplanır — son oturum ≠ gün toplamı', () => {
    const svc = read('shared/services/sleepHealth.ts');
    const fn = svc.slice(svc.indexOf('async getSleepSummary'), svc.indexOf('async getSleepSummary') + 900);
    expect(fn).toContain('lastSessionMinutes(');
    expect(fn).toContain('bucketByDay(');
    // Dar pencere filtresi olmadan "en son oturum" günler öncesine düşerdi
    expect(fn).toContain('recentSleepWindow()');
  });
});

describe('processSleep artık gereksiz async değil', () => {
  it('await gerektirmeyen iş için mikro-görev sıçraması yapmaz', () => {
    const fn = CODE.slice(CODE.indexOf('const processSleep'), CODE.indexOf('const announce'));
    expect(fn).not.toContain('async');
    expect(fn).not.toContain('await');
  });

  it('ölü yerel değişkenler kalmadı', () => {
    const fn = CODE.slice(CODE.indexOf('const processSleep'), CODE.indexOf('const announce'));
    // toast taşındıktan sonra bunların tüketicisi kalmamıştı
    expect(fn).not.toContain('formatSleepDuration(');
  });
});
