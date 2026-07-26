import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * DASHBOARD SIFIR DURUMU — sayfanın ilk sözü.
 *
 * ÖLÇÜLEN SORUN: gün başında dashboard yukarıdan aşağı şunu söylüyordu —
 *   momentum 5 (boş grafikle) · 0/1 görev · %0 halka · "1 gecikmiş görev" (kırmızı)
 *   · beş boş alışkanlık halkası · süresi geçmiş görev (kırmızı)
 * Yani ÜÇ SIFIR ve DÖRT KIRMIZI sinyale karşılık tek bir cesaretlendirici cümle — o da
 * veriyle çelişen bir cümle ("Hadi devam edelim!" derken altında hiçbir şey yapılmadığı
 * yazıyor). Sayfanın en büyük puntosu, sayfadaki en kötü iki sayıya ayrılmıştı.
 *
 * Bu bir SKORBORD ve skor sıfırken skorbord göstermek kimseyi harekete geçirmez, suçlar.
 * Bu testler düzeltmenin geri sızmasını engelliyor — hepsi tek tek "kötü görünmüyordu"
 * diye geri alınabilecek, ayrı ayrı masum görünen kararlar.
 */
describe('dashboard sırası', () => {
  const src = read('app/index.tsx');

  /**
   * SIRA DENENDİ VE GERİ ALINDI. Gün açılmamışken eylem çağrısı sayfanın en üstüne,
   * selamlamanın hemen altına taşınmıştı. Mantığı doğruydu (sayfa skorla değil eylemle
   * açılsın) ama SAYFANIN RİTMİNİ bozdu: momentum satırı kartsızdır ve selamlamayla
   * kartlar arasında yumuşak bir geçiş kuruyordu; üstüne kart konunca iki ağır kartın
   * arasında sıkışıp öksüz kaldı. Doğru mantık, yanlış sonuç.
   */
  it('eylem çağrısı kartların arasında — koşullu sıra YOK', () => {
    expect(src).not.toContain('dayNotStarted');
    expect(src).toContain('{nextMissionCard}');
  });

  it('kart TEK yerde tanımlı — iki konuma kopyalanmadı', () => {
    expect((src.match(/<NextMissionCard/g) ?? [])).toHaveLength(1);
  });

  it('momentum selamlamadan hemen sonra gelir — geçiş satırı', () => {
    const hero = src.indexOf('<DashboardHero');
    const momentum = src.indexOf('<MomentumPulse');
    const today = src.indexOf('<TodayCard');
    expect(hero).toBeLessThan(momentum);
    expect(momentum).toBeLessThan(today);
  });
});

describe('kırmızı yalnız gerçekten bozulan şeyler için', () => {
  it('gecikmiş görev bandı uyarı tonunda — sayfanın ilk rengi kırmızı olmasın', () => {
    const src = read('app/index.tsx');
    const start = src.indexOf('{overdueCount > 0 && (');
    const end = src.indexOf("'overdue tasks'}", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    // JSX blok yorumları da elenmeli — eski renkten SÖZ etmek serbest, yazmak değil.
    const band = src.slice(start, end).replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    expect(band).not.toContain('theme.error');
    expect(band).toContain('theme.warning');
  });

  it('görev satırındaki "Süresi geçti" de uyarı tonunda', () => {
    const src = read('shared/components/MyDayTaskRow.tsx');
    expect(src).toContain('isOverdue ? theme.warning');
  });

  it('etiket rengi elle KISILMIYOR — ölçülen kontrast korunsun', () => {
    // `opacity: 0.5` palet rengini kullanım yerinde kısıyordu; ölçülmüş kontrastı
    // geçersiz kılar (bkz. colorContrast.test.ts).
    // Yorumlar sayılmaz — eski değerden SÖZ etmek serbest, yazmak değil.
    const code = read('shared/components/MyDayTaskRow.tsx')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    const label = code.match(/color: isOverdue \? theme\.warning[\s\S]{0,300}?\}\}>/)?.[0] ?? '';
    expect(label).not.toBe('');
    expect(label).not.toMatch(/opacity: 0\.\d/);
  });
});

/**
 * MOMENTUM GİZLENMEZ.
 *
 * Blok bir ara veri yetersizken tamamen kaldırılmıştı. Yanlıştı: çalışan bir özelliği
 * kullanıcıdan saklamak, kötü görünen bir durumu düzeltmek değildir. Gerçek sorun
 * grafiğin YANLIŞ CÜMLE kurmasıydı — "son 7 gün" yazıp neredeyse boş bir grafik
 * göstermek, kullanıcıya "yedi günlük verine bakıyorsun ve düz" dedirtiyordu.
 * Halbuki söylenmesi gereken "grafik henüz dolmadı"ydı.
 */
describe('momentum — gizlenmez, doğru cümleyi kurar', () => {
  const src = read('shared/components/MomentumPulse.tsx');

  it('veri yetersiz diye blok kaldırılmaz', () => {
    expect(src).not.toContain('if (daysWithData < 3) return null;');
  });

  it('altyazı grafiğin gerçekte ne olduğunu söyler', () => {
    expect(src).toContain('const buildingUp = daysWithData < 3;');
    expect(src).toContain('grafik doluyor');
    expect(src).toContain('chart filling up');
  });
});

describe('bugün kartı — sıfırken susar', () => {
  const src = read('features/dashboard/components/TodayCard.tsx');

  it('gün başı AYRI bir durum olarak tanımlı', () => {
    expect(src).toContain('const notStarted = hasGoal && completed === 0;');
  });

  /**
   * Halka bir ara sifirda tamamen GIZLENMISTI. Cift sifiri cozuyordu ama kartin sag
   * yanini bosaltip karti tek yana yatiriyordu — bir sorunu digeriyle degistirmek.
   * Geometri korunuyor, icindeki sayi degisiyor: bitirdigin degil, hedefledigin.
   */
  it('halka sıfırda da çizilir — kartın sağ yanı boş kalmasın', () => {
    expect(src).not.toContain('{!notStarted && <View style={styles.ringBox}>');
  });

  it('sıfırda halkanın içi HEDEFİ gösterir, yüzdeyi değil', () => {
    expect(src).toContain('testID="today-goal"');
    expect(src).toMatch(/notStarted \? \(/);
  });

  it('alt satır sıfırda ileri bakar', () => {
    expect(src).toContain("'gün yeni başlıyor'");
    expect(src).toContain("'the day is just starting'");
  });
});
