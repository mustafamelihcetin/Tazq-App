import React from 'react';
import { View, Text } from 'react-native';
import { Coffee, Flame, CheckCircle2 } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
// Saf metin yardımcısı utils'e taşındı (uyku sınıflandırıcısı da kullanıyor);
// buradan yeniden dışa veriliyor ki mevcut içe aktarmalar kırılmasın.
import { compactHabitLabel } from '@/features/habits/utils/habitLabel';
import { describeHabit } from '@/shared/utils/a11y';
export { compactHabitLabel };
import { renderModeEmojiIcon } from '@/features/modes';
import type { AppTheme } from '@/shared/constants/Colors';
import { F, S, ICON, R } from '@/shared/constants/tokens';

/**
 * Etiket satır yüksekliği. 9.5pt yazının doğal satır aralığından biraz açık: iki satır
 * alt alta gelince harfler birbirine değmesin. Yuvanın yüksekliği bunun İKİ katı
 * (bkz. aşağıdaki not) — sabit tutuluyor ki kısa ve uzun adlar aynı hizada bitsin.
 */
const LABEL_LINE = 12;

/**
 * YUVA GENİŞLİĞİ — baloncuktan geniş, çünkü ETİKETİ o taşıyor.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Bu sayı 62 idi ve düzeltilmesi gerektiği ÖLÇÜLEREK belgelenmişti: 268 alışkanlık
 * adının 218'i 18 karakterden uzun; 62pt'ye satır başına ~11 karakter sığıyor, yani
 * "Direnç antrenmanı", "Günlük protein hedefi" gibi adların hiçbiri tam görünmüyordu.
 * 78pt'de satır başına ~17, iki satırda ~34 karakter sığıyor.
 *
 * Ama düzeltme BURAYA hiç ulaşmamış: 78 yalnız MyDayHabits'teki "Ekle" kısayoluna
 * uygulanmış, gerçek baloncuklar 62'de kalmıştı. İki sonucu vardı — etiketler
 * kesilmeye devam ediyordu ve "Ekle" kutusu ötekilerden geniş olduğu için şeridin
 * ritmi bozuktu (oysa oradaki not "dolu baloncuklarla aynı boyutta" diyor).
 *
 * Sayı artık burada ve TEK: etiketi çizen bileşen, yuvasının genişliğini de tanımlar.
 */
export const HABIT_SLOT = 78;


export interface HabitBubbleProps {
  item: any;
  theme: AppTheme;
  isDark: boolean;
  tr: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export const HabitBubble = React.memo<HabitBubbleProps>(({ item, theme, isDark, tr, onPress, onLongPress }) => {
  const streakVal = item.streak || 0;
  const size = 50;
  const isCompleted = item.isCompleted;
  const isSkipped = item.isSkipped;

  // Flat styling:
  // 1. The outer circle border is ALWAYS a quiet neutral color (borderını boyamıyoruz).
  // 2. Completed state uses a soft mode-colored background tint (flat).
  // 3. The icon and the badges are painted in the solid mode's color.

  const bgColor = isCompleted
    ? item.color + (isDark ? '24' : '15') // soft flat tint matching the mode's color
    : isSkipped
    // Kehribar TEK kaynaktan: ikon ve zemin aynı jetondan türüyor. Elle yazıldığında
    // koyu temada ikon (#FBBF24) ile zemin (#D97706) farklı iki kehribar oluyordu.
    ? theme.warning + (isDark ? '26' : '14')
    : 'transparent';

  const borderColor = isDark
    ? 'rgba(255, 255, 255, 0.1)'
    : 'rgba(0, 0, 0, 0.06)';

  const iconColor = isCompleted
    ? item.color // icon is solid mode color!
    : isSkipped
    ? theme.warning
    : isDark
    ? 'rgba(255, 255, 255, 0.45)' // quiet neutral icon when pending
    : 'rgba(0, 0, 0, 0.4)';

  /*
    Sesli ad TAM addır, görsel etiket ise KIRPILMIŞ (compactHabitLabel) — kırpma bir
    yer darlığı çözümüdür, isim değil. Baloncuğun içinde metin yok; ekran okuyucu
    burada yalnız "düğme" duyuyordu.
  */
  const a11yLabel = item.title ?? item.name ?? '';

  return (
    <Touchable
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={describeHabit({ doneToday: isCompleted, skipped: isSkipped, streak: streakVal }, a11yLabel, tr ? 'tr' : 'en')}
      accessibilityState={{ checked: !!isCompleted }}
      accessibilityHint={tr ? 'Dokun: işaretle · Basılı tut: seçenekler' : 'Tap to toggle · Long press for options'}
      style={{ alignItems: 'center', width: HABIT_SLOT, gap: S.sm }}
    >
      <View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
        borderWidth: 1.5,
        borderColor: borderColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Atlandı ikonu, zemin ve ikon rengiyle AYNI jetondan (bkz. yukarıdaki not). */}
        {isSkipped ? (
          <Coffee size={ICON.md} color={theme.warning} />
        ) : (
          renderModeEmojiIcon(item.emoji ?? '📌', 20, iconColor)
        )}

        {streakVal >= 3 && !isSkipped && (
          <View style={{
            position: 'absolute',
            bottom: -3,
            right: -3,
            backgroundColor: item.color, // flame badge colored matching the mode's color!
            borderRadius: R.sm,
            paddingHorizontal: S.xs,
            paddingVertical: S.xxs,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1.5,
            // Rozet, ARKASINDAKİ yüzeyin rengiyle çevrelenip oyulmuş gibi duruyor;
            // o yüzey kartın kendisi (bkz. BentoCard → surfaceCard).
            borderColor: theme.surfaceCard,
          }}>
            <Flame size={ICON.xs} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={{ fontSize: F.caption, fontWeight: '700', color: '#FFFFFF', marginLeft: S.xxs }}>{streakVal}</Text>
          </View>
        )}

        {isCompleted && (
          <View style={{
            position: 'absolute',
            top: -2,
            right: -2,
            backgroundColor: item.color, // checkmark badge colored matching the mode's color!
            borderRadius: R.full,
            width: 13,
            height: 13,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            // Rozet, ARKASINDAKİ yüzeyin rengiyle çevrelenip oyulmuş gibi duruyor;
            // o yüzey kartın kendisi (bkz. BentoCard → surfaceCard).
            borderColor: theme.surfaceCard,
          }}>
            <CheckCircle2 size={ICON.xs} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/*
        İKİ SATIR — tek satırdayken alışkanlıkların NEREDEYSE HEPSİ kesiliyordu.
        62pt'lik yuvada 9.5pt yazı ~11 karakter alır; "Direnç antrenmanı", "Günlük
        protein hedefi", "Kalori fazlası" gibi gerçek adların hiçbiri sığmıyor. Ekranda
        yan yana beş tane "Direnç antre…" durunca sayfa bitmemiş görünüyor — kullanıcı
        bunu tasarım tercihi değil, eksik iş diye okur.

        Yükseklik SABİT (iki satırlık): bir etiket bir satır, komşusu iki satır olursa
        baloncuklar aynı hizada başlasa da satır altı tırtıklı biter. Sabit yükseklikle
        ritim korunuyor, kısa adlar da aynı yuvayı kaplıyor.

        `opacity` KALDIRILDI: ölçülmüş rengi kullanım yerinde kısmak kontrastı geçersiz
        kılar (bkz. colorContrast.test.ts) — bu dosyada 0.8 ile %20 kısılıyordu, üstelik
        zaten 9.5pt olan bir yazıda. Soluk görünüm artık renk SEVİYESİNDEN geliyor.
      */}
      <Text
        style={{
          fontSize: F.caption,
          lineHeight: LABEL_LINE,
          height: LABEL_LINE * 2,
          fontWeight: '700',
          color: isCompleted ? theme.onSurfaceMuted : theme.onSurface,
          textAlign: 'center',
          textDecorationLine: isCompleted ? 'line-through' : 'none',
          width: '100%',
        }}
        numberOfLines={2}
      >
        {compactHabitLabel(item.title)}
      </Text>
    </Touchable>
  );
});
