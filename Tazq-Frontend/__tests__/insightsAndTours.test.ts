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
 * PROFİL — koyu temada okunmayan buton + ham hex.
 */
describe('Profil — koyu tema kontrastı ve ham hex', () => {
  const SRC = read('app/profile.tsx');

  it('"Kaydet" düğmesi sabit beyaz değil, theme.onPrimary kullanır', () => {
    const saveBlock = SRC.slice(SRC.indexOf('onPress={handleSaveProfile}'), SRC.indexOf('</Touchable>', SRC.indexOf('onPress={handleSaveProfile}')));
    expect(saveBlock).not.toMatch(/color:\s*'white'/);
    expect(saveBlock).toContain('theme.onPrimary');
  });

  it('en uzun seri ikonu ham hex değil theme.streak kullanır', () => {
    expect(SRC).not.toContain('#ff9f0a');
    expect(SRC).toContain('theme.streak');
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
  const MODAL = read('features/onboarding/components/HelpTourModal.tsx');
  const PREVIEW = read('features/onboarding/components/TourFeaturePreview.tsx');

  it('dashboard turu var olmayan bir düğme anlatmıyor, gösterge ikonunu anlatıyor', () => {
    expect(MODAL).not.toMatch(/Karta dokunarak haftalık karneni/);
    expect(MODAL).toContain('gösterge ikonuna dokunarak');
    expect(PREVIEW).not.toContain('Haftalık karneni gör');
  });

  it('cockpit turu grafikleri AYRI ekrana yönlendiriyor, Kokpit içindeymiş gibi anlatmıyor', () => {
    expect(MODAL).toContain('Başlıktaki düğmeye dokunarak');
    // Eski mockup Kokpit'in içinde sahte "Haftalık Hedef 23/30" çubuğu çiziyordu.
    expect(PREVIEW).not.toContain('Haftalık Hedef');
  });

  it('modlar turu artık kaydırma jestinden bahsediyor (ModeDeck)', () => {
    expect(MODAL).toMatch(/sağa sola kaydır|swipe left and right/);
  });

  it('aktif planı olan kullanıcı için YENİ bir tur adımı var, olmayana gösterilmiyor', () => {
    expect(MODAL).toContain('ACTIVE_MODE_STEP_TITLES');
    expect(MODAL).toContain('hasActiveMode');
    expect(MODAL).toContain("useActiveModeSummary()");
  });

  it('yeni adım dashboard dizisinin SONUNA eklendi — mevcut önizleme eşlemesi kaymadı', () => {
    // dashboard-0..4 hâlâ eski sırasında olmalı: ilk adım yine momentum (Rocket).
    const dashboardBlock = MODAL.slice(MODAL.indexOf('dashboard: ['), MODAL.indexOf('tasks: ['));
    const firstStepIdx = dashboardBlock.indexOf('Icon: Rocket');
    const activeModeIdx = dashboardBlock.indexOf('activeModeStep');
    expect(firstStepIdx).toBeGreaterThan(-1);
    expect(activeModeIdx).toBeGreaterThan(firstStepIdx);
  });
});
