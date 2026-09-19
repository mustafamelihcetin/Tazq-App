import { useCallback, useState } from 'react';
import { FocusService, DailyFocusData } from '@/shared/services/api';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { computeStreakFromHistory } from '@/features/dashboard/utils/streakDay';
import { httpStatusOf } from '@/shared/utils/errors';
import { swallow } from '@/shared/utils/swallow';

/**
 * Haftalık odak istatistiklerini çeker ve seri (streak) durumunu eşitler.
 *
 * app/index.tsx'ten çıkarıldı: üç ayrı state (weeklyFocus / lastWeekMinutes /
 * statsLoading) ile onları dolduran fetch aynı işin parçasıydı ama ekranın
 * gövdesine dağılmıştı. Birlikte değişen şeyler birlikte dursun.
 */
export type WeeklyStats = {
  weeklyFocus: DailyFocusData[];
  lastWeekMinutes: number;
  /** İlk yükleme bitene kadar true. Türetilmiş hesapların erken çalışmaması için kapı. */
  loading: boolean;
  refresh: () => Promise<void>;
};

export function useWeeklyStats(): WeeklyStats {
  const [weeklyFocus, setWeeklyFocus] = useState<DailyFocusData[]>([]);
  const [lastWeekMinutes, setLastWeekMinutes] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const stats = await FocusService.getStats();
      setWeeklyFocus(stats.weeklyFocus || []);
      setLastWeekMinutes(stats.lastWeekFocusMinutes || 0);

      // Sunucudaki seri yereli besler: yeni cihaz/kurulumda yerel 0 iken sunucudaki
      // gerçek seri kaybolmasın.
      //
      // DAVRANIŞ NOTU (bilinçli düzeltme): index.tsx'teki hâli `localStreak`'i render
      // closure'ından okuyordu ve `useFocusEffect(useCallback(..., []))` bu closure'ı
      // ilk render'da donduruyordu — yani her yenilemede BAYAT bir değere bakıyordu.
      // İlk render'da 0 yakalanmışsa, kullanıcının çevrimdışı kazandığı seri (ör. 3)
      // sunucunun bayat değeriyle (ör. 1) eziliyordu. getState() ile taze okumak bunu
      // önler ve yorumun anlattığı niyeti gerçekten uygular.
      /*
        SUNUCUNUN SERİSİ YEDEK, KAYNAK DEĞİL.

        Sunucu seriyi görevin VADE gününe göre hesaplıyor (veritabanında tamamlanma
        tarihi alanı yok) — yani "dün vadeli işi bugün bitirdim" onun için dünkü
        aktiflik demek. Yeni cihazda yerel seri 0 iken bu sayı olduğu gibi kabul
        ediliyordu. Artık önce YEREL geçmişten, ekranın kendi kuralıyla hesaplanıyor
        (bkz. computeStreakFromHistory); o da 0 çıkarsa sunucunun sayısı yedek olarak
        kullanılır — böylece gerçekten seri sahibi kullanıcı sıfırlanmaz.
      */
      const active = stats.activeStreak || 0;
      if (useFocusStore.getState().localStreak === 0) {
        const focus = useFocusStore.getState();
        const computed = computeStreakFromHistory({
          tasks: require('@/features/tasks/store/useTaskStore').useTaskStore.getState().tasks,
          habits: require('@/features/habits/store/useHabitStore').useHabitStore.getState().habits,
          focusDate: focus.dailyFocusDate,
          focusMinutes: focus.dailyFocusMinutes,
          focusGoalMinutes: focus.dailyGoalMinutes,
        });
        const seed = computed > 0 ? computed : active;
        if (seed > 0) useFocusStore.setState({ localStreak: seed });
      }
      useFocusStore.getState().updateBestStreak(useFocusStore.getState().localStreak);
    } catch (e: unknown) {
      // 401 beklenen bir durum (oturum yenileme akışı ele alır) — gürültü yapma.
      if (httpStatusOf(e) !== 401) swallow('weeklyStats.refresh', e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { weeklyFocus, lastWeekMinutes, loading, refresh };
}
