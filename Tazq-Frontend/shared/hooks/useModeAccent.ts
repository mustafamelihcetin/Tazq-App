import { useMemo } from 'react';
import { useAppTheme } from './useAppTheme';
import { modeAccent, modeAccentText } from '@/shared/constants/Colors';

/**
 * Modun vurgu renklerini aktif temaya göre çözer.
 *
 * İKİ ROL döner ve ikisini karıştırmamak önemli:
 *  - `accent`     → DOLGU: ikon kutusu, ilerleme çubuğu, kenarlık, dolu buton zemini,
 *                   büyük geri sayım rakamı. WCAG büyük-metin eşiğini (3:1) geçer.
 *  - `accentText` → KÜÇÜK YAZI: caption/etiket ("GÜN", "%40", "3 gün kaldı").
 *                   Aynı ton ailesinin bir adım koyusu; AA küçük-metin (4.5:1) geçer.
 *
 * Neden hook: mod kartları vurgularını modül seviyesinde ham hex olarak tutuyordu
 * (`const SPOR = '#F97316'`). Bu hem iki temada AYNI rengi veriyor hem de paletin
 * kontrast yetersizliği nedeniyle reddettiği tonları geri getiriyordu. Modül sabiti
 * temayı okuyamaz — bu yüzden hook.
 */
export function useModeAccent(type: string) {
  const { colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  return useMemo(() => ({
    accent: modeAccent(type, isDark),
    accentText: modeAccentText(type, isDark),
  }), [type, isDark]);
}
