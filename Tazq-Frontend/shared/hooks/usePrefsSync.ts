import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/features/user/store/useAuthStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';

// Tercih değişikliklerini (mod seçimleri, planlar, üretkenlik saati vb.) debounce ederek
// backend'e gönderir. Yalnızca giriş yapılmış ve çevrimiçiyken push edilir.
// Çevrimdışıyken tercihler lokalde kalıcı kalır; tekrar online olununca sonraki değişiklikte
// (ya da online geçişinde) güncel snapshot gönderilir.
const DEBOUNCE_MS = 2500;

export function usePrefsSync() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const firstRun = useRef(true);

  useEffect(() => {
    // prefs store'daki herhangi bir alan değiştiğinde tetiklenir.
    const schedule = () => {
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const { isLoggedIn: logged } = useAuthStore.getState();
        const { isOnline: online } = useNetworkStore.getState();
        if (!logged || !online) return; // online/login olunca aşağıdaki effect yakalar
        /*
          BAYRAK ANCAK BAŞARIDA TEMİZLENİR.

          Eskiden istek gönderilmeden ÖNCE `dirty = false` yapılıyordu ve `syncToCloud`
          hatayı içeride yuttuğu için başarısızlık hiç fark edilmiyordu: sunucu 500/429
          dönse bile değişiklik "gönderildi" sayılıp buluttaki kopya bir sonraki tercih
          değişikliğine kadar bayat kalıyordu. Faturası yeni cihazda kesiliyordu — orada
          yerel veri olmadığı için bulut kazanır ve kullanıcı eski ayarlarını geri alır.
        */
        usePrefsStore.getState().syncToCloud().then((ok) => { if (ok) dirty.current = false; });
      }, DEBOUNCE_MS);
    };
    const unsub = usePrefsStore.subscribe(schedule);
    /*
      AYNI PAKETLE GİDEN İKİ DEPO (2026-11-02, çevrimdışı denetimi): başarımlar ve momentum geçmişi de bu
      gönderimle taşınıyor (bkz. syncToCloud → __achievements / __momentum), ama kendi depolarında değişiyorlardı.
      Çevrimdışıyken kazanılan başarım ya da günün kaydı gönderilemezse "bekleyen" sayılmıyor, internet gelince
      yeniden denenmiyordu. Artık onların değişikliği de bekleyen işaretini yakar.
    */
    // Tembel require: shared → features doğrudan içe aktarılmaz (bkz. architecture testi).
    const { useAchievementStore } = require('@/features/user/store/useAchievementStore');
    const { useMomentumStore } = require('@/features/user/store/useMomentumStore');
    const unsubAch = useAchievementStore.subscribe((st: { unlocked: string[] }, prev: { unlocked: string[] }) => { if (st.unlocked !== prev.unlocked) schedule(); });
    const unsubMom = useMomentumStore.subscribe((st: { history: unknown[] }, prev: { history: unknown[] }) => { if (st.history !== prev.history) schedule(); });
    return () => {
      unsub(); unsubAch(); unsubMom();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Online + login geçişlerinde, bekleyen (dirty) değişiklikleri flush et.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (isLoggedIn && isOnline && dirty.current) {
      // Aynı kural: başarısız denemede bayrak AÇIK kalır, bir sonraki geçişte tekrar denenir.
      usePrefsStore.getState().syncToCloud().then((ok) => { if (ok) dirty.current = false; });
    }
  }, [isLoggedIn, isOnline]);
}
