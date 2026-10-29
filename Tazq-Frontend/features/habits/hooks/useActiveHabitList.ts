import { useMemo } from 'react';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { activeHabits } from '@/features/habits/utils/habitLimit';

/**
 * BUGÜNE BAKAN yüzeyler için alışkanlık listesi — dinlendirilenler hariç (madde 6).
 *
 * Eşitleme, dışa aktarma ve geçmiş raporları TÜM listeyi okumaya devam eder; yalnız
 * "bugün ne yapacağım" sorusunu cevaplayan ekranlar bunu kullanır.
 * useMemo: seçicide filtrelemek her çağrıda yeni dizi döndürür ve zustand'ı sonsuz
 * yeniden çizime sokar.
 */
export function useActiveHabitList() {
  const habits = useHabitStore(s => s.habits);
  return useMemo(() => activeHabits(habits), [habits]);
}
