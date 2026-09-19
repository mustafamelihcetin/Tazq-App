import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { patchTask } from '@/features/tasks/utils/taskActions';
import { SOMEDAY_TAG } from '@/features/tasks/utils/taskTags';
import { wantsReminder } from '@/features/tasks/utils/recurrenceInterval';
import { cancelTaskNotification, scheduleTaskNotification } from '@/shared/utils/notifications';
import { swallow } from '@/shared/utils/swallow';
import { parseDateKey } from '@/shared/utils/dateKey';
import type { RebalancePlan } from '@/features/tasks/utils/taskBalancer';

/**
 * TAZQZen PLANINI UYGULAR — ve GERİ ALINABİLİR kılar.
 *
 * Karar motorda (taskBalancer, saf); burası yalnız yan etkiler. Önceki hâlin ölçülmüş
 * kusurları ve buradaki karşılıkları:
 *
 *  · GERİ ALMA YOKTU. Tek dokunuş onlarca görevin tarihini değiştiriyor, rafa aldıklarının
 *    asıl tarihini SİLİYORDU. Her uygulama artık önceki hâlini kaydediyor ve `undo`
 *    döndürüyor.
 *  · BİLDİRİMLER TAŞINMIYORDU. Bugünden ileri atılan görevin hatırlatıcısı BUGÜN yine
 *    çalıyor, yeni günü için kurulmuyordu. Taşınan her görevin bildirimi iptal edilip
 *    yeni gününe kuruluyor; rafa alınanınki yalnız iptal ediliyor.
 *  · ÇEVRİMDIŞI GÜVENSİZDİ ve BAYAT KOPYA gönderiyordu. Yazma artık `patchTask`ten
 *    geçiyor: iyimser, kuyruğa alınan, reddedilirse geri dönen tek yol.
 *
 * Rafa alınan görevin SAATİ de temizleniyor: tarihsiz ama saatli bir görev için bildirim
 * sistemi hatırlatıcıyı BUGÜNE kurar (bkz. scheduleTaskNotification). Geri almada eski
 * saat geri gelir.
 */

/**
 * Motorun gün anahtarı ('2026-09-21') → uygulamanın yazma biçimi: o günün YEREL
 * öğleni (bkz. taskActions → localDateISO). Yalın tarih `new Date()` ile UTC gece
 * yarısı okunur ve UTC'nin gerisindeki saat dilimlerinde görev bir ÖNCEKİ güne düşer;
 * öğlen, her saat diliminde ve yaz saati geçişinde aynı günde kalır.
 */
export function dayKeyToDueDate(key: string): string {
  const d = parseDateKey(key);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

export interface ApplyContext {
  language: string;
  hideNotificationContent: boolean;
}

export interface AppliedRebalance {
  /** Gerçekten taşınan görev sayısı. */
  moved: number;
  /** Bir güne yerleşen / rafa alınan. */
  scheduled: number;
  someday: number;
  /** Sunucunun reddettiği (mağazada geri alınan) görev sayısı. */
  failed: number;
  /** Uygulananı geri alır. Bir kez çalışır; ikinci çağrı hiçbir şey yapmaz. */
  undo: () => Promise<void>;
}

interface Snapshot {
  id: number;
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  tags: string[];
}

async function rearm(s: Snapshot, ctx: ApplyContext) {
  try {
    await cancelTaskNotification(s.id);
    // Geçmiş bir zamana bildirim kurulmaz (scheduleTaskNotification kendisi eler).
    if (s.dueDate && wantsReminder(s.tags)) {
      await scheduleTaskNotification(
        s.id, s.title, s.dueDate, s.dueTime, ctx.language, ctx.hideNotificationContent,
      );
    }
  } catch (e) {
    swallow('rebalance.rearmNotification', e);
  }
}

export async function applyRebalance(plan: RebalancePlan, ctx: ApplyContext): Promise<AppliedRebalance> {
  const before: Snapshot[] = [];
  let scheduled = 0;
  let someday = 0;
  let failed = 0;

  await Promise.all(plan.moves.map(async ({ task, to }) => {
    /*
      Plan hesaplandıktan SONRA görev değişmiş olabilir (tamamlandı, arşivlendi,
      silindi). Karar TAZE hâle göre veriliyor: artık açık olmayan bir görevi taşımak,
      kullanıcının az önce bitirdiği işi ileri bir güne geri koymak olurdu.
    */
    const fresh = useTaskStore.getState().tasks.find((t) => t.id === task.id);
    if (!fresh || fresh.isCompleted || fresh.isArchived) return;

    const snap: Snapshot = {
      id: fresh.id,
      title: fresh.title,
      dueDate: fresh.dueDate ?? null,
      dueTime: fresh.dueTime ?? null,
      tags: [...(fresh.tags ?? [])],
    };

    const tags = to === null
      ? Array.from(new Set([...snap.tags, SOMEDAY_TAG]))
      : snap.tags; // tarih verildiği için patchTask etiketi kendisi düşürür
    const next: Snapshot = {
      ...snap,
      dueDate: to === null ? null : dayKeyToDueDate(to),
      dueTime: to === null ? null : snap.dueTime,
      tags,
    };

    const result = await patchTask(fresh.id, { dueDate: next.dueDate, dueTime: next.dueTime, tags: next.tags });
    if (result === 'failed') { failed += 1; return; }
    if (result === 'skipped') return;

    before.push(snap);
    if (to === null) someday += 1; else scheduled += 1;
    await rearm({ ...next, tags: to === null ? next.tags : next.tags.filter((t) => t !== SOMEDAY_TAG) }, ctx);
  }));

  let undone = false;
  const undo = async () => {
    if (undone) return;
    undone = true;
    await Promise.all(before.map(async (snap) => {
      const result = await patchTask(snap.id, { dueDate: snap.dueDate, dueTime: snap.dueTime, tags: snap.tags });
      if (result === 'ok' || result === 'queued') await rearm(snap, ctx);
    }));
  };

  return { moved: before.length, scheduled, someday, failed, undo };
}
