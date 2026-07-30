import React from 'react';
import { View, Text } from 'react-native';
import { Coffee, Flame, CheckCircle2 } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
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
 * BALONCUK ETİKETİ — adın yalnız ADI, açıklaması değil.
 *
 * Alışkanlık adlarının bir kısmı iki iş birden yapıyor: ad + koçluk detayı.
 *   "Kalori fazlası ile beslen (TDEE + 300-500)"
 *   "Düzenli uyku (7–9 saat) — kas onarımı için kritik"
 *
 * Yuva 62'den 78pt'ye çıkarıldı ve etiket iki satıra alındı; ikisi de gerekliydi ama
 * yetmedi — parantez içi detay tek başına satırları dolduruyor ve ad yine "…" ile
 * kesiliyor. Yan yana beş kesik kelime sayfayı bitmemiş gösteriyor.
 *
 * Detay SİLİNMİYOR, yalnız bu 78pt'lik yuvada gösterilmiyor: görev satırında ve
 * alışkanlık detayında tam metin duruyor. Kompakt gösterim adı taşır, açıklamayı değil.
 *
 * Yalnız " (" ve " — / – " ayraçlarında kesiliyor: normal tireli kelimeler
 * ("check-in", "e-posta") bozulmasın diye. Kalan parça anlamsız derecede kısaysa
 * (3 karakterden az) tam ada dönülüyor — kırpma bir adı yok etmemeli.
 */
export function compactHabitLabel(title?: string | null): string {
  // Başlık boş/tanımsız gelebiliyor (çevrimdışı kuyruktaki geçici kayıtlar, eksik
  // çeviri). Eskiden `{item.title}` sessizce boş çiziyordu; kırpma eklenince aynı veri
  // çökmeye başladı. Bileşen bir veri boşluğu yüzünden ekranı düşürmemeli.
  if (!title) return '';
  const head = title.split(/\s+[—–]\s+|\s*\(/)[0].trim();
  return head.length >= 3 ? head : title;
}

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
    ? (isDark ? 'rgba(217, 119, 6, 0.15)' : 'rgba(217, 119, 6, 0.08)')
    : 'transparent';

  const borderColor = isDark
    ? 'rgba(255, 255, 255, 0.1)'
    : 'rgba(0, 0, 0, 0.06)';

  const iconColor = isCompleted
    ? item.color // icon is solid mode color!
    : isSkipped
    ? '#d97706'
    : isDark
    ? 'rgba(255, 255, 255, 0.45)' // quiet neutral icon when pending
    : 'rgba(0, 0, 0, 0.4)';

  return (
    <Touchable
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={{ alignItems: 'center', width: 62, gap: S.sm }}
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
        {isSkipped ? (
          <Coffee size={ICON.md} color="#d97706" />
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
            borderColor: isDark ? '#1C1C1E' : '#FFFFFF',
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
            borderColor: isDark ? '#1C1C1E' : '#FFFFFF',
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
