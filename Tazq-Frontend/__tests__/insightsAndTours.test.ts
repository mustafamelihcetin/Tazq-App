import fs from 'fs';
import path from 'path';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

/**
 * TAZQ INSIGHTS — "karmaşık ve çirkin, uygulamayla uyuşmuyor" denetiminin devamı.
 *
 * Mod-ozet'ten beş kat daha fazla ham renk taşıyordu: mavi-mor LinearGradient'lı
 * iki kart, amber/yeşil/indigo üçlüleri elle yazılmış rgba'larla. Bulgular:
 *  · Gradyan kaldırıldı (uygulamanın hiçbir yerinde stat kartı gradyanla çizilmiyor).
 *  · Skor + öneri artık TEK kart (aralarında hairline) — mod-ozet'teki desenle aynı.
 *  · Üç tavsiye tonu (olumlu/uyarı/motive edici) artık theme.success/warning/secondary.
 */
describe('TAZQ Insights — ham renk ve gradyan yok', () => {
  const SRC = read('features/dashboard/components/StatusHubModal.tsx');

  it('LinearGradient hiç kullanılmıyor', () => {
    expect(SRC).not.toContain('LinearGradient');
    expect(SRC).not.toContain("from 'expo-linear-gradient'");
  });

  it('mavi-mor / amber / indigo ham rgba üçlüleri temizlendi', () => {
    expect(SRC).not.toMatch(/rgba\(59,\s*130,\s*246/);
    expect(SRC).not.toMatch(/rgba\(147,\s*51,\s*234/);
    expect(SRC).not.toMatch(/rgba\(217,\s*119,\s*6/);
    expect(SRC).not.toMatch(/#d97706|#34D399|#059669|#818CF8|#2563EB/i);
  });

  it('üç tavsiye tonu tema token\'larından geliyor', () => {
    const fn = SRC.slice(SRC.indexOf('weeklyTips.map'), SRC.indexOf('const text ='));
    expect(fn).toContain('theme.success');
    expect(fn).toContain('theme.warning');
    expect(fn).toContain('theme.secondary');
  });

  it('skor ve öneri TEK kart — aralarında Separator, iki ayrı kutu değil', () => {
    expect(SRC).toContain('<Separator theme={theme} />');
  });

  it('elle çizilmiş ayırıcı yok — Separator bileşeni kullanılıyor', () => {
    expect(SRC).not.toMatch(/height: 1, backgroundColor: theme\.separator/);
  });
});

/**
 * İÇGÖRÜ MODALI — impeccable denetimi (2026-10-31), 15/20.
 */
describe('TAZQ Insights — denetim düzeltmeleri', () => {
  const SRC = read('features/dashboard/components/StatusHubModal.tsx');

  it('alışkanlık rengi ortak kuraldan (habitColor) — ham habit.color değil', () => {
    // Modal 30 Ekim renk kararına bağlanmayan TEK yüzeydi: mod alışkanlıkları eski şablon
    // rengiyle, koyu temada açık tonla çiziliyordu; Haftalık Merkez'le aynı alışkanlık farklı renkti.
    expect(SRC).toContain('habitColor(habit, isDark)');
    expect(SRC).not.toMatch(/habit\.color \|\|/);
  });

  it('ızgara satırı ekran okuyucuya gün gün durumu söylüyor', () => {
    // Hücrelerin etiketi yoktu: VoiceOver/TalkBack yalnız alışkanlığın adını okuyordu.
    expect(SRC).toContain('accessibilityLabel={c.habitRow(');
    expect(SRC).toContain('importantForAccessibility="no-hide-descendants"');
  });

  it('kapat düğmesi 36 pt ama dokunma alanı 44 pt', () => {
    expect(SRC).toContain('hitSlop={touchSlop(CLOSE_SIZE)}');
  });

  it('ızgara da grafikle aynı gün kısaltmasını kullanıyor (Pzt, Pt değil)', () => {
    expect(SRC).not.toContain("'Pt'");
    expect(SRC).toContain("'Pzt'");
  });

  it('değişim yüzdesi dile göre yazılıyor', () => {
    expect(SRC).toContain('formatDeltaPct(delta.pct, language)');
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
