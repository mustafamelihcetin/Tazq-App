import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { MotiView } from 'moti';
import { useSeenChange } from '@/shared/hooks/useSeenChange';
import { useReduceMotion } from '@/shared/hooks/useReduceMotion';
import { F, R, S } from '@/shared/constants/tokens';

/*
  "+1" — ANINDA SONUÇ (B2, 2026-10-31). Bir iş bitince ait olduğu yerde (ör. ana sayfadaki mod satırı)
  kısa bir işaret: yaptığın bir yere gitti. Fark tek motordan gelen sayının son görülen değerinden
  okunur (useSeenChange) — ayrı bir "etki" hesabı yok.

  Animasyon dili: bilgi taşır, BİR KEZ oynar (belir → dur → sön), durur. "Hareketi azalt"ta hiç
  çizilmez. Ekran okuyucuya okunmaz: satırın kendi etiketi yeni sayıyı zaten söylüyor.
*/
const SHOW_MS = 1400;

export function GainBadge({ seenKey, value, color }: { seenKey: string; value: number; color: string }) {
  const reduceMotion = useReduceMotion();
  const { delta } = useSeenChange(seenKey, value);
  const [shown, setShown] = useState<number | null>(delta > 0 ? delta : null);

  useEffect(() => {
    if (delta <= 0) { setShown(null); return; }
    setShown(delta);
    const t = setTimeout(() => setShown(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [delta, value]);

  if (reduceMotion || shown == null) return null;
  return (
    <MotiView
      key={value}
      from={{ opacity: 0, translateY: 4 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 220 }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ backgroundColor: color + '1F', borderRadius: R.full, paddingHorizontal: S.xs, paddingVertical: S.xxs / 2 }}
    >
      <Text style={{ color, fontSize: F.caption, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{`+${shown}`}</Text>
    </MotiView>
  );
}
