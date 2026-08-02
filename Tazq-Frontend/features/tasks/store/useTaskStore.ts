import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubtaskItem, RecurrenceType, Priority } from '@/shared/services/api';
import { swallow } from '@/shared/utils/swallow';

export interface Task {
  id: number;
  title: string;
  description: string;
  dueDate?: string | null;
  dueTime?: string | null;
  isCompleted: boolean;
  completedAt?: string | null;
  // API'nin beklediği birleşim tipiyle aynı. Eskiden `string` idi ve bu yüzden görevi
  // API'ye geri gönderen her çağrı `priority as any` yazmak zorunda kalıyordu —
  // yani geçersiz bir öncelik değeri derlemede yakalanmıyordu.
  priority: Priority;
  tags: string[];
  subtasks?: SubtaskItem[];
  recurrence?: RecurrenceType;
  sortOrder?: number;
  isArchived?: boolean;
  ignoreMomentum?: boolean;
}

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  dailyProgressText: string;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  removeTask: (taskId: number) => void;
  updateTask: (taskId: number, updated: Partial<Task>) => void;
  toggleTaskCompletion: (taskId: number) => void;
  toggleSubtask: (taskId: number, subtaskIndex: number) => void;
  reorderTasks: (orderedIds: number[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useTaskStore = create<TaskState>()(persist((set, get) => ({
  tasks: [],
  isLoading: false, // false: persisted tasks are available immediately on cold start
  dailyProgressText: '',

  setTasks: (tasks) => {
    // Preserve local completedAt timestamps when server refreshes (server doesn't track this)
    const existing = new Map(get().tasks.map(t => [t.id, t]));
    let lang: 'tr' | 'en' = 'tr';
    let lookupSystemString: any = null;
    try {
      lang = require('@/shared/store/useLanguageStore').useLanguageStore.getState().language;
      lookupSystemString = require('@/features/tasks/utils/systemTaskTranslator').lookupSystemString;
    } catch (e) { swallow('taskStore.resolveLanguageForMerge', e); }

    const merged = tasks.map(t => {
      const local = existing.get(t.id);
      let updatedTask = { ...t };
      if (t.isCompleted && local?.completedAt && !t.completedAt) {
        updatedTask.completedAt = local.completedAt;
      }

      if (updatedTask.description && updatedTask.description.startsWith('{"tr":')) {
        try {
          const parsed = JSON.parse(updatedTask.description);
          if (parsed.tr && parsed.en) {
            updatedTask.title = lang === 'tr' ? parsed.tr : parsed.en;
          }
        } catch (e) { swallow('taskStore.parseLocalizedTitleOnUpdate', e); }
      } else if (lookupSystemString) {
        const found = lookupSystemString(updatedTask.title, lang);
        if (found) {
          updatedTask.title = found;
        }
      }
      return updatedTask;
    });

    // Deduplicate by ID to prevent repeating items in the store state
    const uniqueMap = new Map<number, Task>();
    merged.forEach(t => {
      if (t && t.id) {
        uniqueMap.set(t.id, t);
      }
    });
    const uniqueTasks = Array.from(uniqueMap.values());

    // Smart Sort:
    // 1. Uncompleted first
    // 2. Manual sort order (if set)
    // 3. Priority (High > Medium > Low)
    // 4. Due Date (Earliest first, nulls at bottom)
    const sorted = uniqueTasks.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      
      // Manual sort order takes precedence if both have non-zero values
      if ((a.sortOrder || 0) !== (b.sortOrder || 0)) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      }

      const priorityMap: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
      const pA = priorityMap[a.priority] || 0;
      const pB = priorityMap[b.priority] || 0;
      if (pA !== pB) return pB - pA;

      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      
      return b.id - a.id; // Newest first as tie-breaker
    });

    set({ tasks: sorted, dailyProgressText: '' });
  },

  addTask: (task) => {
    const updated = [task, ...get().tasks];
    get().setTasks(updated);
  },

  removeTask: (taskId) => {
    const updated = get().tasks.filter((t) => t.id !== taskId);
    get().setTasks(updated);
  },

  updateTask: (taskId, updated) => {
    const newTasks = get().tasks.map((t) =>
      t.id === taskId ? { ...t, ...updated } : t
    );
    get().setTasks(newTasks);
  },

  toggleTaskCompletion: (taskId) => {
    const now = new Date();
    const newTasks = get().tasks.map((t) => {
      if (t.id !== taskId) return t;
      const completing = !t.isCompleted;
      if (completing) {
        let isOverheated = false;
        let isLite = false;

        try {
          const { useMomentumStore } = require('../../user/store/useMomentumStore');
          const momentumStore = useMomentumStore.getState();
          const isPerfect = momentumStore.addCompletedTask();
          isOverheated = momentumStore.isOverheated;
          momentumStore.triggerRocketFeedback(t.title, isPerfect);
        } catch (e) {
          swallow('taskStore.registerCompletion', e);
        }

        try {
          const { usePrefsStore } = require('@/features/modes/store/usePrefsStore');
          isLite = usePrefsStore.getState().uiMode === 'lite';
        } catch (e) { swallow('taskStore.readUiModePref', e); }

        const ignore = !isLite && isOverheated;

        return { 
          ...t, 
          isCompleted: true, 
          completedAt: now.toISOString(),
          ignoreMomentum: ignore,
          /*
            ALT GÖREVLER DE KAPANIR.

            Tek dokunuşla tamamlamak doğru — alt görevleri tek tek işaretlemeye zorlamak
            işi bitmiş kullanıcıya angarya çıkarır. Ama eski hâllerinde bırakılırlarsa
            kayıt kendi kendisiyle çelişir: satırda üstü çizili başlık ve yanında "1/4".
            Aynı görev hem bitmiş hem bitmemiş görünür.

            Geri alındığında alt görevler kapalı KALIR (aşağıya bkz.) — çünkü hangisinin
            gerçekten yapıldığını uygulama bilemez; kullanıcı düzeltebilir.
          */
          subtasks: (t.subtasks ?? []).map((st) => ({ ...st, done: true })),
        };
      } else {
        try {
          const { useMomentumStore } = require('../../user/store/useMomentumStore');
          const momentumStore = useMomentumStore.getState();
          if (!t.ignoreMomentum) {
            momentumStore.undoCompletedTask();
          }
        } catch (e) {
          swallow('taskStore.registerUncompletion', e);
        }
        return { ...t, isCompleted: false, completedAt: null, ignoreMomentum: false };
      }
    });
    get().setTasks(newTasks);
  },

  toggleSubtask: (taskId, subtaskIndex) => {
    const newTasks = get().tasks.map((t) => {
      if (t.id !== taskId) return t;
      const subs = [...(t.subtasks || [])];
      if (subs[subtaskIndex]) {
        subs[subtaskIndex] = { ...subs[subtaskIndex], done: !subs[subtaskIndex].done };
      }
      return { ...t, subtasks: subs };
    });
    get().setTasks(newTasks);
    /*
      SUNUCUYA DA YAZ — yoksa işaretleme ilk tazelemede siliniyordu.

      Burası eskiden yalnız yerel listeyi güncelliyordu. Yerel liste kalıcı olduğu için
      tik bir süre duruyor, ama `getTasks` → `setTasks` çalıştığı anda sunucunun kopyası
      üzerine yazıyor ve alt görevlerin hepsi `done: false`a dönüyordu.

      Kalıcılık ÇAĞRI NOKTASINA değil buraya bağlandı: alt görev işaretlemesi ileride
      başka bir ekrandan da yapılabilir ve o ekran bu adımı unutursa hata sessizce geri
      gelir. Store tek giriş noktası olduğu için burada olması unutulmaya kapalı.
    */
    try {
      require('@/features/tasks/utils/subtaskSync').persistSubtasks(taskId);
    } catch (e) { swallow('taskStore.persistSubtasks', e, { capture: true }); }
  },

  reorderTasks: (orderedIds) => {
    const taskMap = new Map(get().tasks.map(t => [t.id, t]));
    const reordered = orderedIds
      .map((id, i) => {
        const task = taskMap.get(id);
        if (task) return { ...task, sortOrder: i };
        return null;
      })
      .filter(Boolean) as Task[];
    // Add any tasks not in the ordered list
    get().tasks.forEach(t => {
      if (!orderedIds.includes(t.id)) reordered.push(t);
    });
    set({ tasks: reordered });
  },

  setLoading: (isLoading) => set({ isLoading }),
}), {
  name: 'tazq-task-store',
  storage: createJSONStorage(() => AsyncStorage),
  // Only persist the minimum needed — exclude subtasks to keep the stored JSON small.
  // Subtasks are re-fetched from the server on next online sync.
  partialize: (state) => ({
    tasks: state.tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate,
      dueTime: t.dueTime,
      isCompleted: t.isCompleted,
      completedAt: t.completedAt,
      priority: t.priority,
      tags: t.tags,
      recurrence: t.recurrence,
      sortOrder: t.sortOrder,
      isArchived: t.isArchived,
      ignoreMomentum: t.ignoreMomentum,
      // subtasks intentionally omitted to keep storage lean
    })),
    dailyProgressText: state.dailyProgressText,
  }),
  // Merge state carefully so offline tasks aren't wiped when reloading
  merge: (persisted: any, current) => {
    return { ...current, tasks: persisted?.tasks || [], dailyProgressText: persisted?.dailyProgressText || '' };
  }
}));

export function getLocalizedTaskTitle(task: { title: string; description?: string | null }, isTr: boolean): string {
  if (!task.description) return task.title;
  if (task.description.startsWith('{"tr":')) {
    try {
      const parsed = JSON.parse(task.description);
      if (parsed.tr && parsed.en) {
        return isTr ? parsed.tr : parsed.en;
      }
    } catch (e) { swallow('taskStore.getLocalizedTaskTitle', e); }
  }
  return task.title;
}

export function getLocalizedTaskDescription(task: { description?: string | null }, isTr: boolean): string | null {
  if (!task.description) return null;
  if (task.description.startsWith('{"tr":')) {
    try {
      const parsed = JSON.parse(task.description);
      if (isTr && parsed.descTr) return parsed.descTr;
      if (!isTr && parsed.descEn) return parsed.descEn;
      return null;
    } catch (e) { swallow('taskStore.getLocalizedTaskDescription', e); }
  }
  return task.description;
}

/**
 * AKTİF GÖREVLER — arşivlenmişler HARİÇ.
 *
 * ── NEDEN AYRI BİR SEÇİCİ ───────────────────────────────────────────────────────
 * Arşiv bayrağı eklendikten sonra her ekranın `!t.isArchived` kontrolünü kendisi
 * yazması gerekiyordu — ve üç ekran (merkez, mod özeti, profil) bunu unuttu. Sonuç
 * kullanıcı için tuhaftı: görev "arşivlendi" ama merkezde duruyor, istatistiklerde
 * sayılıyordu. Yani arşivlemek bir yerde işe yarıyor, başka yerde yaramıyordu.
 *
 * Bu, tek tek yamanabilecek bir hata değil: her yeni ekran aynı kontrolü yeniden
 * yazmak zorunda kalır ve biri eninde sonunda unutur. Varsayılanın DOĞRU olması
 * gerekiyor — arşivlenmişi görmek isteyen (yalnızca arşiv ekranı) açıkça `tasks`
 * okur, geri kalan herkes bunu kullanır.
 *
 * `useShallow`: filtre her çağrıda yeni bir DİZİ üretir ama elemanlar aynı nesnelerdir.
 * Sığ karşılaştırma olmadan her render yeni referans görüp gereksiz yere yeniden
 * çizerdi — uzun listede gözle görülür bir maliyet.
 */
export const useActiveTasks = () =>
  useTaskStore(useShallow((s: TaskState) => s.tasks.filter((t) => t && !t.isArchived)));
