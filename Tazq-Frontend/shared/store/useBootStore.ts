import { create } from 'zustand';

/**
 * AÇILIŞ DURUMU (2026-10-31). Açılış artık uygulama ağacının ÜSTÜNDE bir katman: ana sayfa onun
 * altında erken kurulur (açılış sönerken arkada beyaz ekran yerine gerçek ana sayfa görünsün diye).
 * Bu yüzden açılışta tetiklenen uyarılar (seri kalkanı), izin penceresi ve turlar açılış
 * BİTENE kadar bekler — yoksa açılışın üstünde belirirlerdi. Kalıcı değil: her açılışta false başlar.
 */
interface BootState {
  splashDone: boolean;
  setSplashDone: () => void;
}

export const useBootStore = create<BootState>()(set => ({
  splashDone: false,
  setSplashDone: () => set({ splashDone: true }),
}));
