import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

/**
 * İÇGÖRÜ PENCERESİ KALDIRILDI (2026-10-31, yeniden düzenleme A3 · K-3).
 *
 * Ana sayfa başlığındaki pencere "bu hafta" sorusunu Bugün ekranında cevaplıyordu. Odak
 * kıyası, en iyi gün, grafik ve öneriler Rapor'da zaten vardı (aynı generateWeeklyTips).
 * Başlık düğmesi artık doğrudan Bu Hafta ekranına gider; pencere geri gelmemeli.
 */
describe('İçgörü penceresi — kopya geri gelmez', () => {
  it("bileşen yok, ana sayfa başlığı Bu Hafta'ya götürür", () => {
    expect(fs.existsSync(path.join(__dirname, '..', 'features/dashboard/components/StatusHubModal.tsx'))).toBe(false);
    // 2026-11-01: başlık düğmesi kalktı — her hedefi zaten bir yolu vardı (kopyaydı).
    expect((read('app/index.tsx') + read('features/dashboard/hooks/useHomeModel.tsx'))).not.toContain('<StatusHub');
  });

  it("öneriler Rapor'da yaşıyor", () => {
    expect(read('app/report.tsx')).toContain('generateWeeklyTips(');
  });
});

describe('Alttan kayan sayfa — Hareketi azalt', () => {
  const SRC = read('shared/hooks/useSwipeToDismiss.ts');

  it('tercih açıkken sayfa kaymaz, yerinde belirir', () => {
    expect(SRC).toContain('useReduceMotion()');
    expect(SRC).toMatch(/if \(reduceMotion\)/);
  });
});

/**
 * PROFİL — koyu temada okunmayan buton + ham hex.
 */
describe('Profil — koyu tema kontrastı ve ham hex', () => {
  const SRC = read('app/profile.tsx');

  it('"Kaydet" düğmesi sabit beyaz değil, theme.onPrimary kullanır', () => {
    const saveBlock = SRC.slice(SRC.indexOf('onPress={handleSaveProfile}'), SRC.indexOf('</Touchable>', SRC.indexOf('onPress={handleSaveProfile}')));
    expect(saveBlock).not.toMatch(/color:\s*'white'/);
    expect(saveBlock).toContain('theme.onPrimary');
  });

  it('en uzun seri ham hex kullanmaz', () => {
    // 2026-10-31: istatistik ikonları kalktı (ProgressCard — sayılar ikonsuz); ham turuncu geri gelmesin.
    expect(SRC).not.toContain('#ff9f0a');
    expect(read('features/user/components/ProgressCard.tsx')).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});

/**
 * AYARLAR — Admin Paneli düğmesindeki ham indigo, zaten var olan A.system'a bağlandı.
 */
describe('Ayarlar — Admin Paneli rengi tek kaynaktan', () => {
  const SRC = read('app/settings.tsx');

  it('#6366F1 ham hex kalmadı', () => {
    expect(SRC).not.toContain('#6366F1');
  });

  it('Admin Paneli bloğu A.system kullanıyor', () => {
    const block = SRC.slice(SRC.indexOf("router.push('/admin')") - 200, SRC.indexOf("router.push('/admin')") + 600);
    expect(block).toContain('A.system');
  });
});

/**
 * YARDIM TURLARI — "her sayfadaki helptour güncel mi" denetimi.
 *
 * Üç somut staleness bulgusu: dashboard'un 4. adımı var olmayan bir "Haftalık
 * karneni gör" düğmesi anlatıyordu (gerçekte BUGÜN kartına dokunmak yalnız kutlama
 * animasyonu tetikliyor); cockpit'in 3. adımı grafikleri Kokpit'in içindeymiş gibi
 * anlatıyordu (gerçekte ayrı bir ekranda, `/report`); modlar'ın 1. adımı bu oturumda
 * eklenen kaydırma jestinden (ModeDeck) hiç bahsetmiyordu.
 */
describe('Yardım turları — güncellik denetimi', () => {
  /*
    2026-10-25: tur yeniden kuruldu (bkz. features/onboarding/tour/tourSteps.ts) —
    sahte önizlemeler kalktı, her adım GERÇEK öğeyi vurguluyor. Buradaki kurallar
    eski turun kayda geçmiş hatalarının yeni yapıda tekrarlanmamasını sağlıyor.
  */
  const STEPS = read('features/onboarding/tour/tourSteps.ts');
  const block = (page: string, next: string) => STEPS.slice(STEPS.indexOf(`${page}: [`), STEPS.indexOf(`${next}: [`));

  it('kokpit karnesi AYRI ekranda açılır — Kokpit içindeymiş gibi anlatılmaz', () => {
    const cockpit = STEPS.slice(STEPS.indexOf('cockpit: ['));
    expect(cockpit).toMatch(/target: 'weeklyReview'[\s\S]*?aç\./);
    expect(STEPS).not.toContain('Haftalık Hedef');
  });

  it('modlar turu kaydırma jestinden bahsediyor (ModeStatusCard deste)', () => {
    expect(block('modlar', 'cockpit')).toMatch(/yana kaydırarak geç|swipe sideways/);
  });

  it('aktif plan adımı var; aktif modu olmayana yapısal olarak gösterilmez', () => {
    expect(block('dashboard', 'tasks')).toContain("target: 'activePlan'");
    // ModeTodayCard aktif mod yokken null döner → hedef ölçülemez → adım atlanır.
    // Hedef kartın içinde (kenar boşluğu dışarıda → delik kart kenarına birebir oturur).
    expect(read('features/modes/components/ModeTodayCard.tsx')).toMatch(/<TourTarget id="activePlan" spotRadius=\{R\.md\}/);
    expect(read('features/modes/components/ModeTodayCard.tsx')).toContain('if (activeCount === 0) return null;');
  });
});
