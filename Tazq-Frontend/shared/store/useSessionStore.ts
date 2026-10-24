import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * MİSAFİR OTURUMU — hesapsız kullanım bayrağı, `shared` katmanında.
 *
 * ── NEDEN BURADA, useAuthStore'DA DEĞİL ───────────────────────────────────────
 * Bu bayrağı okuması gereken üç yer de ALTYAPI ve üçü de `shared`'da:
 *   · api.ts        — istek sunucuya çıkmasın
 *   · useOfflineSync — kuyruk boşuna denenmesin
 *   · BottomNavBar   — sunucu gerektiren sekme gösterilmesin
 *
 * `useAuthStore` ise `features/user` altında. Üçünün oradan okuması `shared → features`
 * yönünde üç YENİ bağımlılık demekti; oysa `shared` en alt katman — herkesin kullandığı,
 * kimseyi tanımayan yer (bkz. __tests__/architecture.test.ts).
 *
 * O testin kendi notu doğru çözümü yazıyor: "Doğru çözüm bağımlılığın YÖNÜNÜ çevirmek."
 * Bayrak burada YAŞIYOR, `useAuthStore` onu YAZIYOR (features → shared, doğru yön).
 * Tek kaynak; ayna değil, yani ayrışamaz.
 *
 * ── NEDEN KALICI ──────────────────────────────────────────────────────────────
 * Misafirlik uygulamayı kapatınca bitmemeli: kullanıcı denemeye devam ederken
 * uygulamayı kapatıp açtığında kendini giriş ekranında bulmamalı.
 */
/** Misafirin hoş geldin ekranında girdiği profil — yalnız bu cihazda. */
export interface GuestProfile {
  name: string;
  avatar: string;
  borderColor: string;
  motto: string;
}

interface SessionState {
  /** Hesapsız (yerel) kullanım. Gerçek oturumla aynı anda ASLA true olmaz. */
  isGuest: boolean;
  setGuest: (v: boolean) => void;
  /**
   * MİSAFİR PROFİLİ (2026-10-24). Hoş geldin eskiden yalnız hesabı olana açılıyordu;
   * misafir hiç görmüyor, selamlama isimsiz kalıyordu. Ad/avatar sunucuya gidemez
   * (misafir), burada saklanır. Hesap açılınca kayıt formu adı buradan doldurur,
   * ana sayfa avatar/çerçeve/mottoyu hesaba yazar ve bunu temizler.
   */
  guestProfile: GuestProfile | null;
  setGuestProfile: (p: GuestProfile | null) => void;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      isGuest: false,
      setGuest: (isGuest) => set({ isGuest }),
      guestProfile: null,
      setGuestProfile: (guestProfile) => set({ guestProfile }),
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'tazq-session-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ isGuest: s.isGuest, guestProfile: s.guestProfile }) as SessionState,
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);

/** Kısa okuma — store'a abone olmadan anlık değer (interceptor, kuyruk). */
export const isGuestSession = (): boolean => useSessionStore.getState().isGuest;
