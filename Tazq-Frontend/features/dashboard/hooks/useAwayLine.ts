import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { swallow } from '@/shared/utils/swallow';
import { awaySentence, nearestGoal } from '@/features/dashboard/utils/awaySentence';

/*
  "SEN YOKKEN" SATIRI (B5, 2026-10-31). Bir önceki açılış BU CİHAZDA tutulur (cihaza özgü bir
  his; bulut gerekmez). Oturumda bir kez okunur ve hemen şimdiyle güncellenir: sonraki ekran
  dönüşleri yeni bir "ara" saymaz. Satır, paneldeki açılış selamının yerine geçer (üst üste binmez).
*/
const KEY = 'tazq.lastOpen.v1';
let sessionPrev: string | null | undefined;

export function useAwayLine(lang: 'tr' | 'en', waiting: number): string | null {
  const seasonal = usePrefsStore(s => s.seasonal);
  const [prev, setPrev] = useState<string | null | undefined>(sessionPrev);

  useEffect(() => {
    if (sessionPrev !== undefined) return;
    AsyncStorage.getItem(KEY)
      .then(v => {
        sessionPrev = v;
        setPrev(v);
        return AsyncStorage.setItem(KEY, new Date().toISOString());
      })
      .catch(e => swallow('useAwayLine', e));
  }, []);

  return useMemo(() => {
    if (!prev) return null;
    const now = new Date();
    return awaySentence({ lastOpen: prev, now, goal: nearestGoal(seasonal, lang, now), waiting, lang });
  }, [prev, seasonal, waiting, lang]);
}

/** Testler için: oturum belleğini sıfırlar (her test yeni bir açılış). */
export function resetAwayLineSession(): void {
  sessionPrev = undefined;
}
