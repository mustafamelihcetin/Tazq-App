import React from 'react';
import { View } from 'react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { R, S } from '@/shared/constants/tokens';

/**
 * İki farklı ilerleme TÜRÜ için iki farklı FORM.
 *
 * Sorun: mod kartlarında "hedefe ilerleme" (uzun vadeli, geri gitmez, %100'de biter)
 * ile "bu hafta antrenman" (kısa vadeli, her hafta sıfırlanır) AYNI dolu çubukla ve
 * aynı yüzdeyle çiziliyordu. Kullanıcı yan yana duran "%40" ve "%33"ü aynı cinsten
 * sanıp karşılaştırıyor/topluyordu.
 *
 * Ayrım artık görsel:
 *  - `bar`      → kesintisiz dolu çubuk = HEDEFE giden yol (biriken, tek yönlü).
 *  - `segments` → ayrık bölmeler = RİTİM (sayılabilir, periyodik olarak sıfırlanır).
 *    Bölme sayısı hedefin kendisidir; "3 antrenmandan 2'si" doğrudan sayılabilir.
 */
export function ProgressRail({
  variant,
  value,
  total,
  color,
  height = 5,
}: {
  variant: 'bar' | 'segments';
  /** bar: 0–100 yüzde · segments: tamamlanan adet */
  value: number;
  /** segments için hedef adet (bar'da kullanılmaz) */
  total?: number;
  color: string;
  height?: number;
}) {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const track = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  if (variant === 'segments') {
    // Çok yüksek hedeflerde bölmeler kıl gibi incelmesin: 10'dan sonrası çubuğa düşer.
    const count = Math.max(1, Math.min(total ?? 1, 10));
    if ((total ?? 0) > 10) {
      const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
      return <ProgressRail variant="bar" value={pct} color={color} height={height} />;
    }
    const filled = Math.max(0, Math.min(value, count));
    return (
      <View style={{ flexDirection: 'row', gap: S.xxs }} accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: count, now: filled }}>
        {Array.from({ length: count }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height,
              borderRadius: R.xs,
              backgroundColor: i < filled ? color : track,
            }}
          />
        ))}
      </View>
    );
  }

  const pct = Math.max(0, Math.min(100, value));
  return (
    <View
      style={{ height, borderRadius: R.xs, backgroundColor: track, overflow: 'hidden' }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <View style={{ height, borderRadius: R.xs, backgroundColor: color, width: `${pct}%` as any }} />
    </View>
  );
}
