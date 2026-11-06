import { CustomAlert as Alert } from '@/shared/components/CustomAlert';
import { swallow } from '@/shared/utils/swallow';
import { isNetworkError } from '@/shared/utils/errors';
import { TaskService } from '@/shared/services/api';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { isGuestSession } from '@/shared/store/useSessionStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { newTaskKey } from '@/features/tasks/utils/clientKey';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { HABIT_PALETTE } from '@/features/habits/utils/habitColor';
import { usePaymentsStore } from '@/features/payments/store/usePaymentsStore';
import { createPaymentAction } from '@/features/payments/utils/paymentActions';
import { parseBackup, planSize, RESTORE_MAX_BYTES, type RestorePlan } from './restoreBackup';

const DEFAULT_HABIT_EMOJI = '💪';

/** Planı yazar. Tek tek ilerler: biri reddedilse kalanlar eklenir, sayı dürüstçe döner. */
export async function applyRestorePlan(plan: RestorePlan): Promise<{ added: number; failed: number }> {
  let added = 0;
  let failed = 0;

  for (const [index, { payload }] of plan.tasks.entries()) {
    const withKey = { ...payload, clientKey: newTaskKey() };
    const local = () => {
      const tempId = -Date.now() - index;
      useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload: withKey });
      useTaskStore.getState().addTask({ ...withKey, id: tempId } as never);
      added += 1;
    };
    // Misafirin kuyruğu kayıt olana kadar bekler (bkz. useOfflineSync).
    if (isGuestSession() || !useNetworkStore.getState().isOnline) { local(); continue; }
    try {
      useTaskStore.getState().addTask(await TaskService.createTask(withKey));
      added += 1;
    } catch (e) {
      if (isNetworkError(e)) local();
      else { failed += 1; swallow('restore.task', e); }
    }
  }

  for (const habit of plan.habits) {
    const id = `habit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    useHabitStore.getState().addHabit(habit.name, DEFAULT_HABIT_EMOJI, HABIT_PALETTE[0].light, id);
    useHabitStore.setState((s) => ({
      habits: s.habits.map((h) => (h.id === id ? { ...h, completedDates: habit.doneOn, skippedDates: habit.restDays } : h)),
    }));
    added += 1;
  }

  for (const payment of plan.payments) {
    if ((await createPaymentAction(payment)) === 'failed') failed += 1;
    else added += 1;
  }

  return { added, failed };
}

export interface RestoreCopy {
  restoreBadFile: string;
  restoreBadFileBody: string;
  restoreNothing: string;
  restoreNothingBody: string;
  restoreConfirm: string;
  restorePreview: (p: { tasks: number; habits: number; payments: number; skipped: number }) => string;
  restoreAdd: string;
  restoreCancel: string;
  restoreDone: (added: number, failed: number) => string;
}

/** Dosya seçimi → önizleme → onay → ekleme. Paket gerekmez: seçici yüklü expo-file-system içinde. */
export async function startBackupRestore(opts: { copy: RestoreCopy; onBusy?: (busy: boolean) => void; toast: (text: string, failed: boolean) => void }): Promise<void> {
  const { copy, onBusy, toast } = opts;
  const bad = () => { Alert.alert(copy.restoreBadFile, copy.restoreBadFileBody); };
  let content: string;
  try {
    const { File } = require('expo-file-system');
    const picked = await File.pickFileAsync({ mimeTypes: ['application/json'] });
    if (picked.canceled) return;
    if ((picked.result.size ?? 0) > RESTORE_MAX_BYTES) { bad(); return; }
    content = await picked.result.text();
  } catch (e) {
    swallow('restore.pick', e);
    bad();
    return;
  }

  const parsed = parseBackup(content, {
    tasks: useTaskStore.getState().tasks,
    habits: useHabitStore.getState().habits,
    payments: usePaymentsStore.getState().payments,
  });
  if (!parsed.ok) { bad(); return; }
  const { plan } = parsed;
  if (planSize(plan) === 0) { Alert.alert(copy.restoreNothing, copy.restoreNothingBody); return; }

  Alert.alert(copy.restoreConfirm, copy.restorePreview({ tasks: plan.tasks.length, habits: plan.habits.length, payments: plan.payments.length, skipped: plan.skipped }), [
    { text: copy.restoreCancel, style: 'cancel' },
    {
      text: copy.restoreAdd,
      onPress: () => {
        onBusy?.(true);
        void applyRestorePlan(plan)
          .then(({ added, failed }) => {
            toast(copy.restoreDone(added, failed), failed > 0);
          })
          .finally(() => onBusy?.(false));
      },
    },
  ]);
}
