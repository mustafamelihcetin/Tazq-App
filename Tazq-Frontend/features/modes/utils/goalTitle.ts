import { useBudgetStore } from '@/shared/store/useBudgetStore';
import { useQuitStore } from '@/shared/store/useQuitStore';
import { stripEmoji } from '@/shared/utils/emoji';
import { birakmaTypeLabel, tasarrufTypeLabel } from '@/shared/utils/lifeModePlans';
import { localizeSporGoal } from './turkishModes';
import type { ActivePlan } from './planSlots';

/*
  HEDEFİN ADI TEK YERDE (2026-11-05, İngilizce arayüzde "Birikim Hedefi" ve "Sigara +1" görüldü). Ad kurulduğu dilde saklanıyordu; türü olan hedefin adı türünden, bugünün dilinde üretilir.
  Kullanıcının kendi yazdığı ad (sınav, tez, mülakat, özel bırakma) olduğu gibi kalır.
*/
export function quitItemName(item: { type: Parameters<typeof birakmaTypeLabel>[0]; name: string }, lang: 'tr' | 'en'): string {
  return item.type === 'ozel' || !item.type ? item.name : birakmaTypeLabel(item.type, lang === 'tr');
}

export function goalTitle(plan: Pick<ActivePlan, 'type' | 'name'>, lang: 'tr' | 'en', fallback: string, short = false): string {
  const tr = lang === 'tr';
  if (plan.type === 'spor') return stripEmoji(localizeSporGoal(plan.name, tr)) || fallback;
  if (plan.type === 'tasarruf') {
    const t = useBudgetStore.getState().budgetType;
    return t ? tasarrufTypeLabel(t, tr) : stripEmoji(plan.name) || fallback;
  }
  if (plan.type === 'birakma') {
    const items = useQuitStore.getState().items;
    if (!items.length) return stripEmoji(plan.name) || fallback;
    const first = quitItemName(items[0], lang);
    if (short) return items.length > 1 ? `${first} +${items.length - 1}` : first;
    return items.map(i => quitItemName(i, lang)).join(', ');
  }
  return stripEmoji(plan.name) || fallback;
}
