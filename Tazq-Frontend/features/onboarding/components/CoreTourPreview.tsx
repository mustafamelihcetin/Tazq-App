import React from 'react';
import { View, Text, type TextStyle, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { Play, Sparkles, Wind } from 'lucide-react-native';
import { TazqLogo } from '@/shared/components/TazqLogo';
import type { AppTheme } from '@/shared/constants/Colors';
import { F, S, ICON, R } from '@/shared/constants/tokens';

/**
 * TUR GÖRSELİ — TAZQ Core: logoya dokun → palet (arama + "Günü Kurtar").
 *
 * TourFeaturePreview'dan AYRI dosya: o dosya 800 satırlık yeni-dosya sınırının hemen
 * altındaydı ve metinleri satır içi ternary ile yazıyordu (çeviri borcu). Yeni görsel
 * hem sınırı aşmasın hem borcu büyütmesin diye burada, metin nesnesiyle.
 * Çerçeve ve dokunma işareti (ScaledScreen) çağıranda kalıyor — tüm görseller aynı çerçeveyi kullansın.
 */

const copy = (tr: boolean) => tr
  ? {
      search: 'Ara ya da görev yaz…',
      cmds: [
        { key: 'zen', title: 'Günü Kurtar', sub: '3 birikmiş işi günlere yay' },
        { key: 'focus', title: 'Hızlı Odak', sub: '25 dakika' },
      ],
    }
  : {
      search: 'Search or write a task…',
      cmds: [
        { key: 'zen', title: 'Save the Day', sub: 'Spread 3 overdue tasks' },
        { key: 'focus', title: 'Quick Focus', sub: '25 minutes' },
      ],
    };

interface Props {
  theme: AppTheme;
  isDark: boolean;
  tr: boolean;
  /** Görselin tekrar sayacı — palet her döngüde yeniden açılır. */
  beat: number;
  card: ViewStyle;
  sectionLabel: TextStyle;
}

export function CoreTourPreview({ theme, isDark, tr, beat, card, sectionLabel }: Props) {
  const c = copy(tr);
  const icons = { zen: { Icon: Wind, color: theme.tertiary }, focus: { Icon: Play, color: theme.primary } } as const;
  return (
    <>
      <View style={{ alignItems: 'center', paddingVertical: S.sm }}>
        <TazqLogo height={20} />
      </View>
      <MotiView
        key={`core${beat}`}
        from={{ opacity: 0, translateY: -8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 420, delay: 380 }}
        style={[card, { marginHorizontal: S.md, gap: S.sm }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.045)', borderRadius: R.full, paddingHorizontal: S.md, paddingVertical: S.sm }}>
          <Sparkles size={ICON.sm} color={theme.primary} />
          <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.search}</Text>
        </View>
        <Text style={[sectionLabel, { color: theme.onSurfaceVariant }]}>TAZQ CORE</Text>
        {c.cmds.map(({ key, title, sub }) => {
          const { Icon, color } = icons[key as keyof typeof icons];
          return (
            <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: S.smd }}>
              <Icon size={ICON.sm} color={color} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurface }}>{title}</Text>
                <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{sub}</Text>
              </View>
            </View>
          );
        })}
      </MotiView>
    </>
  );
}
