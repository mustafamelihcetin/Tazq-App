import { useEffect, useRef } from 'react';
import { create } from 'zustand';

/*
  TEK HEDEFİ KAPATMA İSTEĞİ (2026-11-05, kullanıcı: "yds'yi kapatmak istedim, karmaşa oldu"). Planım hedefin ne olduğunu bilir, nasıl kapanacağını kart bilir: bildirimler,
  ölçüler, geri alma kartın içinde. Planım onay alır, isteği buraya yazar; yuvanın sahibi kart kendi kapatma kodunu çalıştırır. Kapatma kodu iki yerde yazılmaz.
*/
interface CloseState { slot: string | null; at: number; request: (slot: string) => void; clear: () => void }

const CLOSE_TTL = 15000;
/** Kartı olmayan bir istek sonradan, kullanıcı unutmuşken çalışmamalı. */
export const closeRequestFresh = (at: number, now: number) => now - at < CLOSE_TTL;

export const useGoalCloseStore = create<CloseState>(set => ({
  slot: null,
  at: 0,
  request: slot => set({ slot, at: Date.now() }),
  clear: () => set({ slot: null, at: 0 }),
}));

export function useCloseRequest(slot: string, close: () => void): void {
  const wanted = useGoalCloseStore(s => s.slot === slot);
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    if (!wanted) return;
    const fresh = closeRequestFresh(useGoalCloseStore.getState().at, Date.now());
    useGoalCloseStore.getState().clear();
    if (fresh) latest.current();
  }, [wanted]);
}

/* YENİ HEDEF YUVASI (2026-11-05, kullanıcı: "2. sınavı ekleyemedim"). Kart satırın altında gizliyken "ikinci sınav ekle" görünmüyordu. Keşfet'teki satır, boş yuvanın formunu yerinde açar. */
export const useGoalAddStore = create<{ slot: string | null; request: (slot: string) => void; clear: () => void }>(set => ({
  slot: null,
  request: slot => set({ slot }),
  clear: () => set({ slot: null }),
}));

export function useAddRequest(slot: string, open: () => void): void {
  const wanted = useGoalAddStore(s => s.slot === slot);
  const latest = useRef(open);
  latest.current = open;
  useEffect(() => {
    if (!wanted) return;
    useGoalAddStore.getState().clear();
    latest.current();
  }, [wanted]);
}
