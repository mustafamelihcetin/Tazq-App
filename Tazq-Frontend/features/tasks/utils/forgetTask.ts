import { cancelTaskNotification } from '@/shared/utils/notifications';
import { deleteTaskFromCalendar } from '@/shared/utils/calendarSync';
import { swallow } from '@/shared/utils/swallow';
import type { PlanMode } from '@/features/modes/store/usePrefsStore';

/**
 * BİR GÖREVİ MAĞAZA DIŞINDA DA UNUTTURMAK.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Görev silmenin ÜÇ ayrı yolu vardı ve üçü farklı şeyler temizliyordu:
 *
 *   · Tek silme        → bildirim iptal · takvim kaydı sil · plan dizilerinden düş
 *   · TOPLU silme      → hiçbiri
 *   · "Tamamlananları temizle" → hiçbiri
 *
 * En görünür sonucu şuydu: beş görevi toplu silen kullanıcı, o beş görevin
 * HATIRLATICILARINI almaya devam ediyordu. Silinmiş bir işin bildirimi, uygulamanın
 * verebileceği en güvensiz sinyaldir.
 *
 * Gözden kaçtığının kanıtı: toplu ARŞİVLEME bildirimleri iptal ediyordu. Arşivlemek
 * silmekten daha zararsız bir işlem; daha zararlısının daha az temizlik yapması bir
 * karar olamaz.
 *
 * Kural artık tek yerde: bir görev ortadan kalkıyorsa, ONA BAĞLI HER ŞEY kalkar.
 */

/**
 * Plan yuvaları — liste mağazanın KENDİ tipinden türüyor.
 *
 * Silme akışında bu liste elle yazılıydı ve ON BİR yuva sayıyordu; mağazada ise ON ÜÇ
 * var. `tasarruf` ve `birakma` unutulmuştu: o planlara ait bir görev silindiğinde
 * kimliği plan dizisinde kalmaya devam ediyordu. Elle tutulan bir liste, yanındaki
 * tip büyüdükçe sessizce eskiyor.
 *
 * `satisfies` derleyiciye "bu dizi PlanMode'un TAMAMINI kapsıyor mu" diye sordurur:
 * mağazaya yeni bir mod eklenip buraya eklenmezse derleme kırılır.
 */
export const PLAN_SLOTS = [
  'exam', 'exam2', 'exam3',
  'tez',
  'mulakat', 'mulakat2', 'mulakat3',
  'spor', 'spor2', 'spor3',
  'ramazan', 'tasarruf', 'birakma',
] as const satisfies readonly PlanMode[];

export type PlanSlot = PlanMode;

export interface PlanSlotState {
  /** Alışkanlık kimlikleri METİN, görev kimlikleri SAYI — mağazanın sözleşmesi. */
  habitIds: string[];
  taskIds: number[];
}

/**
 * Plan dizilerinden verilen kimlikleri düşürür — SAF.
 *
 * Yalnız GERÇEKTEN değişen yuvaları döndürüyor: her yuvayı koşulsuz yeniden yazmak,
 * hiçbir şey değişmese bile tercih mağazasını kirletir ve bulut eşitlemesini
 * gereksiz yere tetikler.
 */
export function planIdsWithout(
  slots: Record<PlanSlot, PlanSlotState>,
  removed: ReadonlySet<number>,
): Array<{ slot: PlanSlot; habitIds: string[]; taskIds: number[] }> {
  const out: Array<{ slot: PlanSlot; habitIds: string[]; taskIds: number[] }> = [];
  for (const slot of PLAN_SLOTS) {
    const cur = slots[slot];
    if (!cur) continue;
    const taskIds = (cur.taskIds ?? []).filter((id) => !removed.has(id));
    if (taskIds.length !== (cur.taskIds ?? []).length) {
      out.push({ slot, habitIds: cur.habitIds ?? [], taskIds });
    }
  }
  return out;
}

/**
 * Bu yardımcının tercih mağazasından İHTİYAÇ DUYDUĞU kadarı.
 *
 * Mağazanın tamamını `any` diye almak kolaydı ama yanlış: burada yalnız plan
 * dizileri ve onları yazan işlev kullanılıyor. Dar bir sözleşme, çağıranın ne
 * verdiğini de derleme zamanında kontrol ettirir.
 */
export type PlanPrefs = {
  setPlanIds: (slot: PlanSlot, habitIds: string[], taskIds: number[]) => void;
} & Partial<Record<`${PlanSlot}PlanHabitIds`, string[]>>
  & Partial<Record<`${PlanSlot}PlanTaskIds`, number[]>>;

/** Tercih mağazasından plan yuvalarını okur (şekli `planIdsWithout` bekliyor). */
export function readPlanSlots(prefs: PlanPrefs): Record<PlanSlot, PlanSlotState> {
  const out = {} as Record<PlanSlot, PlanSlotState>;
  for (const slot of PLAN_SLOTS) {
    out[slot] = {
      habitIds: prefs[`${slot}PlanHabitIds`] ?? [],
      taskIds: prefs[`${slot}PlanTaskIds`] ?? [],
    };
  }
  return out;
}

/**
 * Görevleri mağaza DIŞINDAKİ her yerden unutturur: bildirim, takvim, plan dizileri.
 *
 * Mağazadan silme işini ÇAĞIRAN yapıyor — geri alma (undo) akışı oradaki anlık
 * güncellemeye dayanıyor ve buraya taşınırsa o akış bozulur.
 */
export function forgetTasks(ids: number[], prefs: PlanPrefs): void {
  if (ids.length === 0) return;

  for (const id of ids) {
    cancelTaskNotification(id);
    deleteTaskFromCalendar(id).catch((e) => swallow('tasks.forgetTask.calendar', e));
  }

  for (const { slot, habitIds, taskIds } of planIdsWithout(readPlanSlots(prefs), new Set(ids))) {
    prefs.setPlanIds(slot, habitIds, taskIds);
  }
}
