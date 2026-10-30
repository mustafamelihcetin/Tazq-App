import { useEffect, useReducer } from 'react';
import { AppState } from 'react-native';

/*
  DAKİKA SAATİ — dijital panelin durum şeridi (bkz. DisplayPanel).

  ÖLÇÜLEN SORUN (2026-10-30, kullanıcı: "saat bazen geç güncelleniyor, 1-2 dakika geriye
  düşebiliyor"). Eski kanca bir kez sınıra kadar bekleyip sonra `setInterval(60_000)` ile
  yeniliyordu. Üç zayıflık:
   1. ARKA PLAN: Android'de RN, uygulama arka plandayken/ekran kapalıyken JS zamanlayıcılarını
      askıya alır. Dönüşte hiçbir şey saati hemen yenilemiyordu → bir sonraki tetiklemeye kadar
      (60 sn'ye kadar) eski dakika.
   2. KAYMA: `setInterval` her turda JS iş parçacığının meşguliyeti kadar gecikir ve gecikmeler
      BİRİKİR; tetikleme anı dakika sınırından uzaklaştıkça ekran dakikanın çoğunda eski kalır.
   3. HİZALAMA milisaniyeyi yok sayıyordu.
  Çözüm: (a) her turda bir SONRAKİ dakika sınırına yeniden hesaplanan tek `setTimeout` (kayma
  birikemez), (b) ön plana dönüşte anında yenile, (c) gösterilen zaman HER ÇİZİMDE `new Date()`
  — durum yalnız yeniden çizim tetikler, saklanan bir Date yoktur, eskiyemez.
*/

/** Bir sonraki dakika sınırına kalan süre (ms) + küçük pay (sınırın bir tık sonrası). */
export function msToNextMinute(nowMs: number): number {
  return 60_000 - (nowMs % 60_000) + 50;
}

export function useMinuteClock(): Date {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => { tick(); schedule(); }, msToNextMinute(Date.now()));
    };
    schedule();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') { tick(); schedule(); }
    });
    return () => { if (t) clearTimeout(t); sub.remove(); };
  }, []);
  return new Date();
}
