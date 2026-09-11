import { create } from 'zustand';

/**
 * ÇUBUK KÜÇÜLME DURUMU — sekme çubuğu ile sayfalar arasındaki tek sinyal.
 *
 * ── NEDEN STORE ───────────────────────────────────────────────────────────────
 * `BottomNavBar` her ekranda AYRI çiziliyor (expo-router'ın sekme düzeni değil,
 * elle yerleştirilen bir bileşen) ve kaydırma bilgisi sayfanın içinde. İkisi
 * arasında prop yolu yok. Bağlam (context) da olurdu ama çubuk sayfanın çocuğu
 * değil kardeşi; store en kısa yol.
 *
 * Tek bir boolean: çubuk küçülmüş mü. Kaydırma pozisyonu burada TUTULMUYOR —
 * her karede store yazmak, çubuğu saniyede 60 kez yeniden çizmek demekti.
 * Yön hesabı `useChromeMinimizeOnScroll` içinde yapılıp yalnız DEĞİŞİM yazılıyor.
 */
interface ChromeState {
  /** Sekme çubuğu ikon-only hâlde mi? */
  minimized: boolean;
  setMinimized: (v: boolean) => void;
}

export const useChromeStore = create<ChromeState>((set) => ({
  minimized: false,
  setMinimized: (minimized) => set((s) => (s.minimized === minimized ? s : { minimized })),
}));
