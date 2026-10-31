import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useFirstInSession } from '@/shared/components/EntranceStage';

/**
 * UYANIŞ SİNYALİ — ana sayfa "canlıyım" desin (2026-10-31).
 *
 * Kullanıcı: "sayfa güncellenince ya da yeni veri gelince sabit kalmamalı". Sayaç şu anlarda
 * artar ve panel (gün çiçeği, cümle, momentum) bir kez tepki verip durur:
 *  · ekrana GERİ dönüş (ilk odak değil — açılışın kendi animasyonu var),
 *  · uygulamanın öne gelmesi (yalnız ana sayfa odaktayken; arkadaki ekranda boşuna oynamasın),
 *  · aşağı çekip yenilemenin bitişi (`wake()` elle çağrılır).
 * Aynı ana düşen iki sinyal (öne gelme + odak) tek uyanış sayılır.
 */
export function useWakeSignal(): [number, () => void] {
  const [count, setCount] = useState(0);
  const last = useRef(0);
  const wake = useCallback(() => {
    const now = Date.now();
    if (now - last.current < 1000) return;
    last.current = now;
    setCount(k => k + 1);
  }, []);

  // Sayfa sekme geçişinde yeniden kuruluyor: yalnız OTURUMDAKİ ilk odak açılıştır, sonraki
  // kurulumların ilk odağı da bir geri dönüştür (uyanır).
  const firstInSession = useFirstInSession('home.wake');
  const seen = useRef(!firstInSession);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (seen.current) wake();
    seen.current = true;
    return () => { focused.current = false; };
  }, [wake]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active' && focused.current) wake(); });
    return () => sub.remove();
  }, [wake]);

  return [count, wake];
}
