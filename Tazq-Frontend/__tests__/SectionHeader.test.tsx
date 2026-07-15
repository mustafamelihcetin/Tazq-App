import fs from 'fs';
import path from 'path';
import React from 'react';
import { render } from '@testing-library/react-native';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { Colors } from '@/shared/constants/Colors';
import { F, W } from '@/shared/constants/tokens';

/**
 * Gruplanmış liste bölüm başlığı — iOS'un imzası, ve uygulamada 20 yerde elle yazılmıştı.
 */

const ROOT = path.resolve(__dirname, '..');
const theme = Colors.light;

const styleOf = (node: any) =>
  Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));

/** Kök düğümün düzleştirilmiş stili. toJSON() null | tek | dizi dönebilir. */
const rootStyle = (r: { toJSON: () => any }) => {
  const j = r.toJSON();
  expect(j).not.toBeNull();
  return styleOf(Array.isArray(j) ? j[0] : j);
};

describe('SectionHeader', () => {
  it('başlığı büyük harfe çevirir', () => {
    const { getByText } = render(<SectionHeader title="Günlük görevlerim" theme={theme} tr />);
    expect(getByText('GÜNLÜK GÖREVLERİM')).toBeTruthy();
  });

  it('Türkçe “i” harfini doğru büyütür — “İ”, “I” değil', () => {
    // Düz toUpperCase() Türkçe'de "i" → "I" verir; doğrusu "İ". "Bugünkü"nün büyüğü
    // "BUGÜNKÜ", "iyi"nin büyüğü "İYİ" olmalı.
    //
    // Bu, aynı hatanın AYNA görüntüsü: backend'de ToLower() Türkçe'de "I"yı "ı" yapıp
    // admin aramasını bozuyordu ve gerçek bir üretim hatasıydı. Yön değişti, tuzak aynı.
    const { getByText } = render(<SectionHeader title="iyi işler" theme={theme} tr />);
    expect(getByText('İYİ İŞLER')).toBeTruthy();
  });

  it('İngilizcede Türkçe kuralı uygulanmaz — “DAILY”, “DAİLY” değil', () => {
    // tr-TR locale'i SABİTLEMİŞTİM ve İngilizce başlıklar "MY DAİLY HABITS" çıkıyordu:
    // Türkçe'yi düzeltirken İngilizce'yi kırmışım. Bu testi MyDayHabits'in İngilizce
    // testi yakaladı — buradaki testler yalnızca Türkçe'ye baktığı için kördü.
    const { getByText } = render(<SectionHeader title="My daily habits" theme={theme} />);
    expect(getByText('MY DAILY HABITS')).toBeTruthy();
  });

  it('dil belirtilmezse İngilizce varsayar — sessizce Türkçe uygulamaz', () => {
    const { getByText } = render(<SectionHeader title="finish it" theme={theme} />);
    expect(getByText('FINISH IT')).toBeTruthy();
  });

  it('yatay girintiyi KENDİ varsaymaz — kapsayıcıdan alır', () => {
    /**
     * Bu testin ÖNCEKİ hâli yanlış bir kuralı savunuyordu: "bileşen dolguyu taşır,
     * çağıran eklemesin". O kural dashboard'da işe yarıyordu ama genellenemezdi —
     * profil sayfasında kapsayıcı zaten girintili, orada bileşenin dolgusu başlığı
     * altındaki karttan kaydırıyordu.
     *
     * Doğru kural: yatay girinti bir LİSTE özelliğidir. iOS'ta da bölüm başlığının
     * girintisi listeden gelir ve satırlarla AYNI olur. Bileşen varsayarsa her farklı
     * kapsayıcıda yanlış olur.
     */
    expect(rootStyle(render(<SectionHeader title="Test" theme={theme} />)).paddingHorizontal).toBe(0);
  });

  it('girinti verildiğinde uygular', () => {
    expect(rootStyle(render(<SectionHeader title="Test" theme={theme} inset={16} />)).paddingHorizontal).toBe(16);
  });

  it('dikey ritmi KENDİ taşır — o kapsayıcının değil, başlığın işi', () => {
    const s = rootStyle(render(<SectionHeader title="Test" theme={theme} />));
    expect(s.paddingTop).toBeGreaterThan(0);
    expect(s.paddingBottom).toBeGreaterThan(0);
  });

  it('okunabilir puntoda — 9pt değil, Apple’ın 13’ü', () => {
    // 9pt yazılıydı: okunabilirliğin alt sınırı (~11) ALTINDA. Başlıklar okunmuyor,
    // "gri bir doku" olarak görülüyordu. F'te 13 yoktu (11'den 14'e atlıyordu), o
    // yüzden 20 yerde elle 9/10 yazılmıştı.
    const { getByText } = render(<SectionHeader title="Test" theme={theme} />);
    const s = styleOf(getByText('TEST'));
    expect(s.fontSize).toBe(F.footnote);
    expect(s.fontSize).toBeGreaterThan(F.caption);
  });

  it('ağırlığı semibold — 9pt’lik heavy başlık anti-desendi', () => {
    // Punto büyüyünce ağırlığa gerek kalmıyor: hiyerarşi puntodan ve renkten geliyor.
    const { getByText } = render(<SectionHeader title="Test" theme={theme} />);
    expect(styleOf(getByText('TEST')).fontWeight).toBe(W.semibold);
  });

  it('rengi GRİ — asla tint', () => {
    // Bir ara mavi (primary) idi ve koyu temada okunmuyordu. Bir başlık ne eylem ne
    // durum bildirir; tint rengin taşıyacağı anlam yok. iOS'ta bölüm başlıkları
    // HER ZAMAN secondaryLabel'dır.
    const { getByText } = render(<SectionHeader title="Test" theme={theme} />);
    const s = styleOf(getByText('TEST'));
    expect(s.color).toBe(theme.onSurfaceVariant);
    expect(s.color).not.toBe(theme.primary);
  });

  it('koyu temada da gri kalır ve okunur', () => {
    const { getByText } = render(<SectionHeader title="Test" theme={Colors.dark} />);
    const s = styleOf(getByText('TEST'));
    expect(s.color).toBe(Colors.dark.onSurfaceVariant);
    expect(s.color).not.toBe(Colors.dark.primary);
  });

  it('ipucu satırını bir seviye aşağıda gösterir', () => {
    const { getByText } = render(
      <SectionHeader title="Test" hint="Tamamlamak için bas" theme={theme} />,
    );
    const h = styleOf(getByText('Tamamlamak için bas'));
    // Eskiden 8.5pt idi — görünmez. Ve opacity ile değil, seviyeyle soluk.
    expect(h.fontSize).toBe(F.caption);
    expect(h.color).toBe(theme.onSurfaceMuted);
    expect(h.opacity).toBeUndefined();
  });

  it('ipucu yoksa hiç render etmez', () => {
    const { queryByText } = render(<SectionHeader title="Test" theme={theme} />);
    expect(queryByText('Tamamlamak için bas')).toBeNull();
  });

  it('başlık ipucundan büyük ve koyu — hiyerarşi punto+renkle kuruluyor', () => {
    const { getByText } = render(<SectionHeader title="Test" hint="ipucu" theme={theme} />);
    const t = styleOf(getByText('TEST'));
    const h = styleOf(getByText('ipucu'));
    expect(t.fontSize).toBeGreaterThan(h.fontSize);
    expect(t.color).not.toBe(h.color);
  });
});
