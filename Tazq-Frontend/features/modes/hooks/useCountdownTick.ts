import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { swallow } from '@/shared/utils/swallow';

/*
  GERİ SAYIMIN AKMASI (2026-10-31).

  Kalan gün sayısı her açılışta aynı karede duruyordu; bir günün geçtiği hissedilmiyordu.
  Kullanıcının bu hedefte EN SON GÖRDÜĞÜ sayı saklanır; bugün daha küçükse sayı o değerden
  bugüne akarak iner (43 → 42). Yalnız gerçek değişimde oynar — her açılışta sahte sayım yok.
  Okuma bitene kadar sayı gizli tutulur (`ready`): önce 42 gösterip 43'e sıçramasın.
*/
const KEY = 'tazq.countdownSeen.v1';
let cache: Record<string, number> | null = null;
let loading: Promise<Record<string, number>> | null = null;

function load(): Promise<Record<string, number>> {
  if (cache) return Promise.resolve(cache);
  loading ??= AsyncStorage.getItem(KEY)
    .then(raw => (cache = raw ? JSON.parse(raw) : {}))
    .catch(e => { swallow('useCountdownTick.load', e); return (cache = {}); });
  return loading;
}

/** Saklanan son görülen değerden bugünküne akış başlangıcı; yalnız sayı AZALDIYSA. */
export function tickFrom(seen: number | undefined, days: number): number | undefined {
  return seen != null && seen > days ? seen : undefined;
}

export function useCountdownTick(id: string, days: number): { ready: boolean; from?: number } {
  const [state, setState] = useState<{ ready: boolean; from?: number }>(() =>
    cache ? { ready: true, from: tickFrom(cache[id], days) } : { ready: false });

  useEffect(() => {
    let alive = true;
    load().then(seen => {
      if (!alive) return;
      setState(s => (s.ready ? s : { ready: true, from: tickFrom(seen[id], days) }));
      if (seen[id] !== days) {
        seen[id] = days;
        AsyncStorage.setItem(KEY, JSON.stringify(seen)).catch(e => swallow('useCountdownTick.save', e));
      }
    });
    return () => { alive = false; };
  }, [id, days]);

  return state;
}
