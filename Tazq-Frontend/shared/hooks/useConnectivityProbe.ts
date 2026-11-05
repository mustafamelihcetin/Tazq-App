import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useNetworkStore } from '@/shared/store/useNetworkStore';

/*
  İNTERNET GERİ GELDİ Mİ (2026-11-05, kullanıcı: "online ya da offline kusursuz çalışmalı"). Uygulama çevrimiçi olduğunu yalnız kendi isteği başarılı olunca öğreniyordu:
  Wi-Fi 40 sn önce gelmişken "bağlantı kesildi" duruyor, bekleyen işler gönderilmiyordu. Çevrimdışıyken arada küçük bir yoklama yapılır; yanıt veren her sunucu çevrimiçi demektir (401 de).
  Yeni yerel bağımlılık yok, derleme gerektirmez. Çevrimiçiyken hiç çalışmaz: pil ve veri harcamaz.
*/
const STEPS_MS = [3000, 5000, 10000, 20000, 30000];
const TIMEOUT_MS = 5000;

/** Deneme arttıkça seyrekleşir, en fazla 30 sn. */
export const probeDelay = (attempt: number) => STEPS_MS[Math.min(attempt, STEPS_MS.length - 1)];

export async function probeOnce(url: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    await fetcher(url, { method: 'GET', signal: ctl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function useConnectivityProbe(healthUrl: string) {
  const isOnline = useNetworkStore(s => s.isOnline);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isOnline) return;
    let attempt = 0;
    let dead = false;
    const run = async () => {
      if (await probeOnce(healthUrl)) { if (!dead) useNetworkStore.getState().setOnline(true); return; }
      if (dead) return;
      timer.current = setTimeout(run, probeDelay(attempt++));
    };
    timer.current = setTimeout(run, probeDelay(attempt++));
    // Uygulamaya dönünce beklemeden bak: kullanıcı en çok o an fark eder.
    const sub = AppState.addEventListener('change', s => {
      if (s !== 'active') return;
      attempt = 0;
      if (timer.current) clearTimeout(timer.current);
      void run();
    });
    return () => { dead = true; sub.remove(); if (timer.current) clearTimeout(timer.current); };
  }, [isOnline, healthUrl]);
}
