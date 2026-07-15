import React from 'react';
import { render } from '@testing-library/react-native';
import { DashboardHero } from '@/features/dashboard/components/DashboardHero';
import { Colors } from '@/shared/constants/Colors';
import { F, W, trackingFor } from '@/shared/constants/tokens';

/**
 * Dashboard'ın karşılama bloğu — kullanıcının gördüğü ilk şey.
 *
 * Bu, index.tsx'ten çıkarılan İLK bölüm. 2000 satırlık tek bileşenin içindeyken test
 * edilemiyordu (ekranı render etmek 14 effect ve 58 store çağrısı demekti); ayrı
 * bileşen olunca prop verip çıktısına bakmak yetiyor. "Parçalama"nın asıl kazancı bu.
 */

const theme = Colors.light;

const setup = (over: Partial<React.ComponentProps<typeof DashboardHero>> = {}) =>
  render(
    <DashboardHero
      greeting="İyi akşamlar"
      name="Melih"
      subGreeting="5 görevin var. Hadi devam edelim!"
      isSmallScreen={false}
      theme={theme}
      {...over}
    />,
  );

/** Bir Text düğümünün düzleştirilmiş stili. */
const styleOf = (node: any) =>
  Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));

describe('DashboardHero', () => {
  it('selamlama ve ismi TEK satırda birleştirir', () => {
    // Tek Text olması önemli: isim iç-span olduğu için uzun isim doğal sarar,
    // kesilmez. Ayrı Text'ler yan yana dizilse taşardı.
    const { getByText } = setup();
    expect(getByText('İyi akşamlar, Melih')).toBeTruthy();
  });

  it('duruma göre değişen alt satırı gösterir', () => {
    const { getByText } = setup({ subGreeting: 'Temiz sayfa — yeni bir hedef?' });
    expect(getByText('Temiz sayfa — yeni bir hedef?')).toBeTruthy();
  });

  it('ismi RENKLENDİRMEZ — selamlamayla aynı renk', () => {
    // Bir isim ne eylem ne durum bildirir; rengin taşıyacağı anlam yok. Marka mavisiyle
    // boyanınca "tıklanabilir/kritik" diyordu ve kullanıcı bunu "sert lacivert, çirkin"
    // diye bildirdi. Eski kodda isme ayrı bir Text sarmalı kalmıştı (rengi aynıydı,
    // yani ölüydü) — geri gelirse burası kırılır.
    const { getByText } = setup();
    expect(styleOf(getByText('İyi akşamlar, Melih')).color).toBe(theme.onSurface);
  });

  it('alt satırı opacity ile değil, ölçülmüş seviyeyle soluklaştırır', () => {
    // Eskiden onSurfaceVariant + opacity 0.7 idi: 7.03:1 → 3.62:1, yani WCAG altı.
    // Bkz. colorContrast.test.ts — bu tam olarak o hatanın dashboard'daki örneğiydi.
    const s = styleOf(setup().getByText('5 görevin var. Hadi devam edelim!'));
    expect(s.color).toBe(theme.onSurfaceMuted);
    expect(s.opacity).toBeUndefined();
  });

  it('hiyerarşiyi yalnızca ağırlıkla kurmaz — punto ve renk de ayrışır', () => {
    // Apple'ın yöntemi: büyük+koyu+bold başlık, küçük+gri+medium alt satır.
    // Uygulamanın eski alışkanlığı hiyerarşiyi SADECE ağırlıktan almaktı (her şey
    // 9-14pt'de sıkışınca tek kaldıraç o kalıyor).
    const { getByText } = setup();
    const g = styleOf(getByText('İyi akşamlar, Melih'));
    const s = styleOf(getByText('5 görevin var. Hadi devam edelim!'));

    expect(g.fontSize).toBeGreaterThan(s.fontSize);
    expect(g.color).not.toBe(s.color);
    expect(g.fontWeight).toBe(W.bold);
    expect(s.fontWeight).toBe(W.medium);
  });

  it('ölçek dışına çıkmaz ve 700’ü aşmaz', () => {
    const g = styleOf(setup().getByText('İyi akşamlar, Melih'));
    // iOS Title 1. Eskiden elle `28` yazılıydı çünkü F'te 22-34 arası delik vardı.
    expect(g.fontSize).toBe(F.display);
    expect(Number(g.fontWeight)).toBeLessThanOrEqual(700);
  });

  it('dar ekranda bir punto küçülür — ama yine ölçekten', () => {
    const g = styleOf(setup({ isSmallScreen: true }).getByText('İyi akşamlar, Melih'));
    expect(g.fontSize).toBe(F.title);
    expect(g.fontSize).toBeLessThan(F.display);
  });

  it('harf aralığı puntodan TÜRETİLİR — sabit yazılmaz', () => {
    // TRACKING.hero (-0.8) sabit yazılıydı; o değer 34pt için, yazı ise 28pt.
    //
    // İlk yazdığım test "iki punto farklı aralık verir" diyordu ve GEÇİYORDU — ama
    // sadece Jest'in geniş ekranı sayesinde: orada ölçek 28'i 31.5'e çıkarıp farklı
    // tracking grubuna atıyor. Gerçek bir 375pt telefonda 22 ve 28'in ikisi de -0.4
    // alır, yani test kırılırdı. Ortama bağlı test, testsizliktir.
    //
    // Doğru iddia: değer sabit değil, puntonun FONKSİYONU. Bu her ekranda doğru.
    for (const small of [false, true]) {
      const s = styleOf(setup({ isSmallScreen: small }).getByText('İyi akşamlar, Melih'));
      expect(s.letterSpacing).toBe(trackingFor(s.fontSize));
    }
  });

  it('ismi yoksa çağıranın verdiği karşılığı gösterir', () => {
    const { getByText } = setup({ name: 'sen' });
    expect(getByText('İyi akşamlar, sen')).toBeTruthy();
  });

  it('koyu temada da metin rengi palete bağlı kalır', () => {
    const { getByText } = setup({ theme: Colors.dark });
    expect(styleOf(getByText('İyi akşamlar, Melih')).color).toBe(Colors.dark.onSurface);
    expect(styleOf(getByText('5 görevin var. Hadi devam edelim!')).color).toBe(
      Colors.dark.onSurfaceMuted,
    );
  });
});
