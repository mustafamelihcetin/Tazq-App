import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { F, S, W, LH, trackingFor } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/**
 * Dashboard karşılama bloğu — selamlama + o ana özel motivasyon satırı.
 *
 * Ekranın PSİKOLOJİK anı burası: kullanıcının gördüğü ilk şey ve tek kişisel cümle.
 * O yüzden iki satırın işi net ayrılmış — selamlama KİMLİK (sabit, sıcak), alt satır
 * DURUM (değişken, yönlendirici). İkisi aynı ağırlıkta olsaydı ne selamlama selamlama
 * olurdu ne de yönlendirme yönlendirme.
 *
 * SUNUM BİLEŞENİ: metinleri hesaplamıyor, alıyor. Alt satır görev/odak/momentum
 * durumuna bakıyor (bkz. index.tsx getSubGreeting) — o mantığı buraya taşımak, bu
 * bileşeni beş store'a bağlar ve test edilemez kılardı.
 */

export interface DashboardHeroProps {
  /** Saate göre selamlama — "İyi akşamlar". */
  greeting: string;
  /** Kullanıcının ilk adı. Yoksa çağıran taraf "sen"/"you" gönderir. */
  name: string;
  /** Duruma göre değişen alt satır — "5 görevin var. Hadi devam edelim!". */
  subGreeting: string;
  /** Dar ekranda selamlama bir punto küçülür. */
  isSmallScreen: boolean;
  theme: AppTheme;
}

export const DashboardHero = React.memo<DashboardHeroProps>(
  ({ greeting, name, subGreeting, isSmallScreen, theme }) => {
    // iOS Title 1 (28) / dar ekranda Title 2 (22). İkisi de ölçekten — eskiden elle
    // yazılıydı çünkü F'te 22-34 arası delik vardı (bkz. tokens.ts).
    const size = isSmallScreen ? F.title : F.display;

    return (
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.section}>
        {/*
          Selamlama ve isim TEK Text: isim iç-span olduğu için doğal sarar, uzun isim
          alt satıra geçer, kesilmez.

          İsim için ayrı bir <Text> sarmalı VARDI ama rengi üst Text'le aynıydı — yani
          hiçbir şey yapmıyordu. İsmi marka mavisiyle boyayan eski koddan kalmıştı;
          renk kaldırılmış, sarmal unutulmuştu. Bir isim ne eylem ne durum bildirir,
          dolayısıyla rengin taşıyacağı bir anlam yok: maviye boyamak onu
          "tıklanabilir/kritik" gibi gösteriyordu.
        */}
        <Text
          style={[
            styles.greeting,
            {
              color: theme.onSurface,
              fontSize: size,
              lineHeight: size * LH.tight,
              // Tracking puntoya BAĞLI: sabit TRACKING.hero (-0.8) yazılıydı, o 34pt
              // için. 28pt'de fazla sıkı duruyordu — harf aralığı puntoyla ölçeklenir.
              letterSpacing: trackingFor(size),
            },
          ]}
        >
          {greeting}, {name}
        </Text>

        {/*
          Alt satır İKİNCİL: bir seviye aşağı renk (onSurfaceMuted) ve normal ağırlık.
          Eskiden onSurfaceVariant + opacity 0.7 idi → 7.03:1 yerine 3.62:1, yani
          okunması zorlaşıyordu. Soluklaştırma artık ölçülmüş bir seviye.
        */}
        <Text style={[styles.sub, { color: theme.onSurfaceMuted, fontSize: F.subhead }]}>
          {subGreeting}
        </Text>
      </MotiView>
    );
  },
);

DashboardHero.displayName = 'DashboardHero';

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: S.lg,
    // Üst boşluk YOK: başlıkla arası topBarSpace'ten geliyor (bkz. index.tsx).
    // Burada da vermek çift sayardı.
    marginBottom: S.lg,
  },
  greeting: {
    fontWeight: W.bold,
    includeFontPadding: false,
  },
  sub: {
    // Selamlama bold, alt satır medium: hiyerarşi PUNTO + RENK + ağırlıkla kuruluyor,
    // yalnızca ağırlıkla değil. Apple'ın yöntemi bu.
    fontWeight: W.medium,
    marginTop: S.xs,
    includeFontPadding: false,
  },
});
