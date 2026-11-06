import React from 'react';
import { View, Text } from 'react-native';
import { Coffee } from 'lucide-react-native';
import { Touchable } from '@/shared/components/Touchable';
import { CompletionBurst } from '@/shared/components/CompletionBurst';
import { HabitLiquid } from '@/features/habits/components/HabitLiquid';
import { useHabitCheck } from '@/features/habits/hooks/useHabitCheck';
// Saf metin yardımcısı utils'e taşındı (uyku sınıflandırıcısı da kullanıyor);
// buradan yeniden dışa veriliyor ki mevcut içe aktarmalar kırılmasın.
import { compactHabitLabel } from '@/features/habits/utils/habitLabel';
import { describeHabit } from '@/shared/utils/a11y';
export { compactHabitLabel };
import { renderModeEmojiIcon } from '@/features/modes';
import type { AppTheme } from '@/shared/constants/Colors';
import { DISPLAY_FONT } from '@/shared/components/DisplayPanel';
import { F, S, R, ICON } from '@/shared/constants/tokens';

/*
  ALIŞKANLIKTA RENK = NEREDEN GELDİĞİ, DURUM = BİÇİM (2026-10-30). Mod alışkanlığı modunun rengini,
  elle eklenen kullanıcının ölçülmüş paletten seçtiği rengi taşır (bkz. habitColor.ts). "Yapıldı mı"yı
  renk tonu değil DOLULUK söyler: boş iz → bekliyor, dolan yay + dolu disk → yapıldı. Böylece renk
  tek anlam taşır (ön-dikkat), renk körü kullanıcı da durumu biçimden okur.
*/

/*
  ALIŞKANLIK HALKASI (2026-10-30) — kullanıcı: "ana sayfadaki alışkanlıklar kısmı çok çirkin;
  yukarıdaki ekranla uyumlu, şık, premium, işlevsel, minimalist; animasyonel de olabilir".
  Eski baloncuk: nötr çerçeve + dolgu + iki rozet (alev, tik) + dört renk kuralı.
  Yeni dil — üstteki dijital panelin ve gün çiçeğinin akrabası:
    · 2026-11-05: halka SIVIYLA dolar (bkz. HabitLiquid, su bardağının dili). Miktarlıda adım adım (3/8), tekilde tek dokunuşta.
    · Tamamlanınca tek seferlik kıvılcım. Rozet yok, doluluk söyler.
    · Mola: kehribar kesik iz + fincan. Dün kaçtıysa ("iki kez kaçırma") köşede küçük nokta:
      bugün yaparsan zincir sürer.
    · Sayaç (3/8, haftalık 2/3) eş aralıklı rakamla, panelle aynı dijital yazı.
  Hareket azaltılmışsa yay animasyonsuz çizilir.
*/

/** Etiket satır yüksekliği; yuva iki satırlık sabit yükseklik taşır (kısa ve uzun adlar aynı hizada biter). */
const LABEL_LINE = 12;

/**
 * YUVA GENİŞLİĞİ — halkadan geniş, çünkü ETİKETİ o taşıyor. 268 alışkanlık adının 218'i 18
 * karakterden uzun; 78pt'de iki satırda ~34 karakter sığar. Sayı TEK: şeritteki "Ekle" de bunu okur.
 */
export const HABIT_SLOT = 78;

const SIZE = 56;
const STROKE = 3;

export interface HabitBubbleProps {
  item: any;
  theme: AppTheme;
  isDark: boolean;
  tr: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export const HabitBubble = React.memo<HabitBubbleProps>(({ item, theme, isDark, tr, onPress, onLongPress }) => {
  /*
    İYİMSER ÇİZİM (2026-10-25, cihazda ölçüldü): halka ana sayfa baştan çizilmeden önce
    yerel durumla dolar; asıl kayıt bir sonraki karede yapılır.
  */
  const { target, isCompleted, count, isSkipped, ratio, burst, press: handlePress } = useHabitCheck(item, onPress);

  const meta: string | null = isSkipped ? null
    : target > 1 && !isCompleted && count > 0 ? `${count}/${target}`
    : (item.weekBadge ?? null);
  const track = isSkipped ? theme.warning + '66' : theme.onSurface + (isDark ? '33' : '24');
  // Sıvı yarıyı geçince simge üstünde okunmalı.
  const iconColor = isSkipped ? theme.warning : ratio >= 0.5 ? theme.onPrimary : theme.onSurfaceVariant;
  const a11yLabel = item.title ?? item.name ?? '';

  return (
    <Touchable
      onPress={handlePress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={describeHabit({ doneToday: isCompleted, skipped: isSkipped, streak: item.streak }, a11yLabel, tr ? 'tr' : 'en') + (meta ? `, ${meta}` : '')}
      accessibilityState={{ checked: !!isCompleted }}
      accessibilityHint={tr ? 'Dokun: işaretle · Basılı tut: mola' : 'Tap to check · Hold for a break'}
      style={{ alignItems: 'center', width: HABIT_SLOT, gap: S.sm }}
    >
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <HabitLiquid size={SIZE} stroke={STROKE} ratio={ratio} color={item.color} track={isCompleted ? item.color : track}>
          {isSkipped ? <Coffee size={ICON.md} color={theme.warning} /> : renderModeEmojiIcon(item.emoji ?? '📌', 20, iconColor)}
        </HabitLiquid>
        <CompletionBurst trigger={burst} color={item.color} radius={SIZE / 2} />
        {item.missed && !isCompleted && !isSkipped && (
          <View accessible={false} style={{ position: 'absolute', top: 1, right: 1, width: S.sm, height: S.sm, borderRadius: R.full, backgroundColor: theme.warning, borderWidth: 1.5, borderColor: theme.surfaceCard }} />
        )}
        {!!meta && (
          <View style={{ position: 'absolute', bottom: -S.xs, paddingHorizontal: S.xs, borderRadius: R.full, backgroundColor: theme.surfaceCard }}>
            <Text style={{ fontFamily: DISPLAY_FONT.digits, fontSize: F.caption, color: theme.onSurface, fontVariant: ['tabular-nums'] }}>{meta}</Text>
          </View>
        )}
      </View>

      {/* İKİ SATIR, sabit yükseklik: tek satırda adların neredeyse hepsi kesiliyordu. Üstü çizilmez —
          alışkanlık 'iptal' değil 'yapıldı'; yay bunu söylüyor. Soluk görünüm renk SEVİYESİNDEN gelir. */}
      <Text
        style={{
          fontSize: F.caption,
          lineHeight: LABEL_LINE,
          height: LABEL_LINE * 2,
          fontWeight: '600',
          color: isCompleted ? theme.onSurfaceMuted : theme.onSurface,
          textAlign: 'center',
          width: '100%',
        }}
        numberOfLines={2}
      >
        {compactHabitLabel(item.title)}
      </Text>
    </Touchable>
  );
});
