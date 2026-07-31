import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
/**
 * YORUMLAR ELENİYOR — `typeSafety.test.ts` ile aynı yöntem.
 *
 * Gerekçe metinleri hatanın kendisinden söz ediyor ("kısa adlar 'stepCount' yazılmıştı")
 * ve yorumlar taransaydı test kendi açıklamasını hata sanardı. Daha kötüsü: hatayı
 * anlatan yorumu SİLMEK testi yeşile döndürürdü — yani test, kaydı silmeyi ödüllendirirdi.
 */
const codeOf = (rel: string) =>
  fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');

const ACTIVITY = codeOf('shared/services/activityHealth.ts');
const SLEEP = codeOf('shared/services/sleepHealth.ts');

/**
 * SAĞLIK TİP TANIMLAYICILARI — cihazda bulunan bir hatanın koruması.
 *
 * HAREKET verisi ilk denemede hiç açılmadı: ayarlardaki anahtar "Sağlık izni verilmedi"
 * deyip geri dönüyordu. Sebep, HealthKit tanımlayıcılarının KISA yazılmasıydı
 * ('stepCount', 'appleExerciseTime'). HealthKit yalnızca tam biçimi tanır
 * ('HKQuantityTypeIdentifierStepCount'); tanımadığı bir dize gelince `requestAuthorization`
 * hata fırlatıyor ve özellik sessizce kapalı kalıyordu.
 *
 * ── NEDEN DERLEYİCİ YAKALAMADI ──────────────────────────────────────────────────
 * Platform kütüphaneleri tembel `require` ile yükleniyor (native yokken uygulama
 * çökmesin diye) ve `require` `any` döndürüyor. Kütüphanenin kendi
 * `QuantityTypeIdentifier` birleşim tipi bu dizeleri anında reddederdi — ama `any` o
 * kapıyı kapatıyor.
 *
 * Bu, `typeSafety.test.ts`te anlatılan uyku evresi hatasının birebir aynı deseni:
 * `any`, derleme zamanında yakalanacak bir hatayı ancak GERÇEK CİHAZDA görülebilen bir
 * hataya çeviriyor. Tembel yükleme gerekli olduğu için `any`yi kaldıramıyoruz;
 * o hâlde kaybedilen doğrulamayı test geri koyuyor.
 */
describe('HealthKit tanımlayıcıları tam biçimde yazılmalı', () => {
  /** Kısa ad kullanımını yakalar: tırnak içinde, HK öneki olmadan yazılmış tipler. */
  const SHORT_FORMS = [
    'stepCount',
    'distanceWalkingRunning',
    'appleExerciseTime',
    'workoutType',
    'sleepAnalysis',
    'bodyMass',
  ];

  it.each(SHORT_FORMS)('kısa ad "%s" tanımlayıcı olarak kullanılmamalı', (short) => {
    // Tırnakla başlayan tam eşleşme aranıyor: 'stepCount' yakalanır ama
    // 'HKQuantityTypeIdentifierStepCount' yakalanmaz.
    const bad = new RegExp(`['"\`]${short}['"\`]`);
    expect(ACTIVITY).not.toMatch(bad);
    expect(SLEEP).not.toMatch(bad);
  });

  it('hareket servisi dört tipin TAMINI tam biçimde istiyor', () => {
    // Dördü de izin listesinde olmalı: biri eksik kalırsa o ölçü sessizce sıfır gelir
    // ve görevler haksız yere tamamlanmamış görünür.
    expect(ACTIVITY).toContain("'HKQuantityTypeIdentifierStepCount'");
    expect(ACTIVITY).toContain("'HKQuantityTypeIdentifierDistanceWalkingRunning'");
    expect(ACTIVITY).toContain("'HKQuantityTypeIdentifierAppleExerciseTime'");
    expect(ACTIVITY).toContain("'HKWorkoutTypeIdentifier'");
  });

  it('uyku servisi tam biçimi korumaya devam ediyor', () => {
    expect(SLEEP).toContain("'HKCategoryTypeIdentifierSleepAnalysis'");
  });

  it('istenen her tip izin listesine de giriyor', () => {
    // Sabit tanımlanıp `requestAuthorization`a verilmeyi unutmak, sessiz kalan bir
    // izne yol açar: kod veriyi okumaya çalışır, iOS boş döner, sebebi görünmez.
    const authLine = ACTIVITY.match(/toRead:\s*\[([^\]]*)\]/)?.[1] ?? '';
    for (const c of ['HK_STEPS', 'HK_DISTANCE', 'HK_EXERCISE', 'HK_WORKOUT']) {
      expect(authLine).toContain(c);
    }
  });

  /**
   * Android tarafında karşılığı: Health Connect kayıt tipleri.
   * Bunlar tam biçim istemiyor ama YAZIMLARI birebir olmalı ('Steps', 'steps' değil).
   */
  it('Health Connect kayıt tipleri doğru yazımda', () => {
    expect(ACTIVITY).toContain("recordType: 'Steps'");
    expect(ACTIVITY).toContain("recordType: 'Distance'");
    expect(ACTIVITY).toContain("recordType: 'ExerciseSession'");
    expect(ACTIVITY).toContain("readRecords('ExerciseSession'");
  });
});
