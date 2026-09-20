import { useHabitStore, type Habit } from '@/features/habits';
import { useTaskStore, type Task } from '@/features/tasks';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { useToastStore } from '@/shared/store/useToastStore';
import { TaskService } from '@/shared/services/api';
import { MODE_TASK_TAGS } from '@/features/modes/utils/planTaskOps';
import { haptic } from '@/shared/utils/haptics';
import { swallow } from '@/shared/utils/swallow';
import { fmtDateKey } from '@/features/habits';
import { toDateKey } from '@/shared/utils/dateKey';
import { planArcFor } from '@/features/modes/utils/planArc';
import { addGoalRecord, describeSlot, fallbackNameFor, makeGoalId, type GoalRecord } from '@/features/modes/utils/goalHistory';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useQuitStore } from '@/shared/store/useQuitStore';

/**
 * MOD KAPATMA — GERİ ALINABİLİR.
 *
 * SORUN: modu kapatmak alışkanlıkları ve görevleri siliyordu ve GERİ DÖNÜŞÜ YOKTU.
 * Onay diyaloğu vardı ama yanlışlıkla onaylayan kullanıcı haftalarca biriktirdiği
 * kurulumu (sınav adı, tarih, günlük süre, alışkanlık geçmişi) kaybediyordu.
 * "Emin misin?" sormak, hatayı ÖNLEMEZ — yalnızca sorumluluğu kullanıcıya yıkar.
 * Doğru desen: eylemi hemen yap, geri almayı kolaylaştır.
 *
 * NASIL ÇALIŞIR
 *  1. Kapatmadan ÖNCE anlık görüntü alınır: moda ait alışkanlıklar (tamamlanma
 *     geçmişiyle birlikte), görevler ve `seasonal` yapılandırma.
 *  2. Kapatma normal şekilde yapılır.
 *  3. Toast'ta "Geri al" çıkar. Basılırsa alışkanlıklar AYNI id ve AYNI
 *     `completedDates` ile geri konur — yani seri/istatistik kaybolmaz.
 *
 * DÜRÜST SINIR: görevler sunucudan silindiği için geri alındığında YENİ id ile
 * yeniden oluşturulur. İçerik, tarih ve tamamlanma durumu korunur; id değişir.
 * Kullanıcı açısından fark edilmez, ama bilinçli bir ödün olduğu için burada yazılı.
 *
 * `seasonal` geri alınırken YALNIZCA kapatma sırasında DEĞİŞEN anahtarlar yazılır.
 * Tüm nesneyi geri yazmak, o birkaç saniyede kullanıcının yaptığı başka bir
 * değişikliği ezerdi.
 */

export interface ModeSnapshot {
  mode: string;
  seasonal: Record<string, any>;
  habits: Habit[];
  tasks: Task[];
  habitIds: string[];
  taskIds: number[];
}

/** Kapatmadan ÖNCE çağrılır — moda ait her şeyin fotoğrafını çeker. */
export function snapshotMode(mode: string): ModeSnapshot {
  const prefs = usePrefsStore.getState();
  const tags = new Set(MODE_TASK_TAGS[mode] ?? []);
  const habitIds: string[] = (prefs as any)[`${mode}PlanHabitIds`] ?? [];
  const taskIds: number[] = (prefs as any)[`${mode}PlanTaskIds`] ?? [];

  return {
    mode,
    seasonal: { ...prefs.seasonal },
    // Alışkanlıklar: hem id listesinden hem `planMode` etiketinden — biri kaçırırsa diğeri yakalar.
    habits: useHabitStore.getState().habits.filter(
      h => habitIds.includes(h.id) || h.planMode === mode
    ).map(h => ({ ...h })),
    // Görevler: etikete göre (id listesi bayat olabilir — zaten bu yüzden
    // etiket tabanlı süpürme eklemiştik).
    tasks: useTaskStore.getState().tasks.filter(
      t => (t.tags ?? []).some(tag => tags.has(tag))
    ).map(t => ({ ...t })),
    habitIds: [...habitIds],
    taskIds: [...taskIds],
  };
}

/** Anlık görüntüyü geri yükler. */
export async function restoreMode(snap: ModeSnapshot): Promise<void> {
  /*
    1) seasonal — yalnız BU MODA AİT ve DEĞİŞMİŞ anahtarlar.

    ÖLÇÜLEN SORUN: eskiden fotoğraftaki TÜM anahtarlar geri yazılıyordu. Senaryo:
    kullanıcı spor modunu kapatıyor, toast çıkıyor; o birkaç saniyede SINAV modunu
    açıyor; sonra "Geri al"a basıyor. Spor geri geliyor ama sınav da KAPANIYOR —
    kullanıcının az önce yaptığı, tamamen ilgisiz bir seçim sessizce geri alınıyor.

    "Geri al" düğmesinin sözü dardır: YALNIZ kendi eylemini geri alır. Arada yapılan
    başka bir şeyi geri almak, düğmenin sözünü aşmaktır.

    KAPSAM NASIL ÇİZİLİYOR: seasonal anahtarları mod adıyla önekli
    (`sporMode`, `sporGoal`, `spor2Date`… / `examMode`, `exam2Name`… / `ramazan`).
    Bu yüzden "bu moda ait" sorusu ad önekiyle kesin cevaplanabiliyor — tahmin yok.
  */
  const now = usePrefsStore.getState().seasonal as Record<string, any>;
  const setSeasonalPref = usePrefsStore.getState().setSeasonalPref;
  for (const key of Object.keys(snap.seasonal)) {
    if (!key.startsWith(snap.mode)) continue;              // başka modun tercihi — dokunma
    if (now[key] === snap.seasonal[key]) continue;          // değişmemiş — gereksiz yazma
    setSeasonalPref(key as any, snap.seasonal[key]);
  }

  // 2) Alışkanlıklar — AYNI id, AYNI completedDates (seri korunur)
  if (snap.habits.length > 0) {
    const existing = new Set(useHabitStore.getState().habits.map(h => h.id));
    const missing = snap.habits.filter(h => !existing.has(h.id));
    if (missing.length > 0) {
      useHabitStore.setState(s => ({ habits: [...s.habits, ...missing] }));
    }
  }

  // 3) Görevler — yeniden oluşturulur (yeni id), içerik/tarih/durum korunur
  const newTaskIds: number[] = [];
  const online = useNetworkStore.getState().isOnline;
  for (const t of snap.tasks) {
    const payload = {
      title: t.title, description: t.description, dueDate: t.dueDate ?? null,
      isCompleted: t.isCompleted, priority: t.priority, tags: t.tags ?? [],
      subtasks: t.subtasks, recurrence: t.recurrence,
    };
    if (!online) {
      const tempId = -Date.now() - newTaskIds.length;
      useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload });
      useTaskStore.getState().addTask({ ...payload, id: tempId } as any);
      newTaskIds.push(tempId);
      continue;
    }
    try {
      const created = await TaskService.createTask(payload as any);
      if (created?.id) { useTaskStore.getState().addTask(created); newTaskIds.push(created.id); }
    } catch (e) {
      swallow('modeUndo.restoreTask', e);
    }
  }

  // 4) Plan id listeleri
  usePrefsStore.getState().setPlanIds(
    snap.mode as any,
    snap.habits.map(h => h.id),
    newTaskIds,
  );
}

/**
 * Modu kapatır ve "Geri al" aksiyonlu bir toast gösterir.
 *
 * `close` fonksiyonu kartın kendi kapatma mantığıdır (bileşene özel: bildirim
 * iptali, yerel state sıfırlama vb.) — buraya taşınmaz, olduğu yerde kalır.
 */
/**
 * KAPANAN HEDEFİN ÖZETİNİ ÇIKAR — kapatmadan ÖNCE çağrılmalı.
 *
 * Kapandıktan sonra hesaplanamaz: görevler emekliye ayrılır, `seasonal` temizlenir,
 * plan kaydı silinir. O yüzden ölçüler tam bu anda alınır.
 *
 * Hiç kurulmamış plan iz bırakmaz (`hasPlan`): modu açıp hemen kapatan kullanıcının
 * geçmişi, hiç yaşamadığı hedeflerle dolmasın.
 */
function captureGoalRecord(mode: string): GoalRecord | null {
  try {
    const prefs = usePrefsStore.getState();
    const bag = prefs as unknown as Record<string, unknown>;
    const habitIds = (bag[`${mode}PlanHabitIds`] as string[] | undefined) ?? [];
    const taskIds = (bag[`${mode}PlanTaskIds`] as number[] | undefined) ?? [];
    if (habitIds.length === 0 && taskIds.length === 0) return null;

    const names = useLanguageStore.getState().t.modeNames;
    const { name, targetKey, emoji } = describeSlot(
      mode,
      prefs.seasonal as unknown as Record<string, unknown>,
      fallbackNameFor(mode, names),
    );
    if (!name) return null;                     // adsız hedefin izi kullanıcıya bir şey anlatmaz

    const todayKey = fmtDateKey();
    const spec = prefs.planSpecs[mode as keyof typeof prefs.planSpecs];
    /*
      BIRAKMA `planSpecs`E HİÇ YAZMAZ — kendi başlangıcını `useQuitStore`da tutar
      (her öğenin `start` tarihi). Bu okunmadan geçmiş, "1 gün bile ilerletmedim"
      diyen bir kullanıcıya "Kapatıldı" yerine sürenin BİLİNMEDİĞİ (`days: null`)
      bir kayıt bırakıyordu; kopya da o durumu "Tamamlandı" diye adlandırıyordu —
      iki ayrı hata üst üste bindiğinde "bitirmediğim şey bitti" yazan bir satır
      çıkıyordu. En ESKİ öğenin başlangıcı alınır: bir seriye en erken ne zaman
      başlandıysa "ne kadar sürdü" sorusunun doğru cevabı odur.
    */
    const quitStart = mode === 'birakma'
      ? useQuitStore.getState().items.map(i => i.start).sort()[0] ?? null
      : null;
    const startKey = spec?.startDate
      ? toDateKey(new Date(spec.startDate))
      : quitStart;
    const habits = useHabitStore.getState().habits;
    const arc = planArcFor({
      startKey, targetKey, todayKey,
      habitCompletions: habitIds.map(id => habits.find(h => h.id === id)?.completedDates),
    });

    return {
      id: makeGoalId(mode, todayKey, Date.now()),
      mode, name, emoji,
      startKey, closedKey: todayKey, targetKey,
      days: arc?.elapsedDays ?? null,
      effortDays: arc?.effortDays ?? null,
    };
  } catch (e) {
    // Geçmiş kaydı bir SÜS; alınamıyorsa kapatma yine de yapılmalı.
    swallow('modeUndo.captureGoalRecord', e);
    return null;
  }
}

export function closeModeWithUndo(
  mode: string,
  close: () => void,
  message: string,
  undoLabel: string,
): void {
  const snap = snapshotMode(mode);
  // Ölçüler kapatmadan ÖNCE alınır; sonra kaynakları kalmaz.
  const record = captureGoalRecord(mode);
  close();
  if (record) usePrefsStore.getState().addGoalHistory(record);
  haptic.destructive();
  useToastStore.getState().show(message, 'info', {
    label: undoLabel,
    onAction: () => {
      // Geri alan kullanıcı hedefi kapatmamış sayılır — geçmişte de görünmemeli.
      if (record) usePrefsStore.getState().removeGoalHistory(record.id);
      restoreMode(snap)
        .then(() => haptic.success())
        .catch(e => swallow('modeUndo.restore', e, { capture: true }));
    },
  });
}
