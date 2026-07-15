/**
 * Bir görevin hangi dönemsel mod planına ait olduğunu (renk + etiket) belirler.
 *
 * İKİ SİNYAL (tutarlılık için): önce plan-id takibi (kesin slot adı), sonra TAG fallback.
 * Tag'ler oluşturulurken sabitlenir ve asla kaymaz (id'ler offline sync'te kayabilir).
 * Böylece bir modun TÜM görevleri (setup, haftalık, günlük, adaptasyon) aynı rengi ve
 * plan adını gösterir — kullanıcının gördüğü "kimi kırmızı/etiketsiz, kimi mavi/KPSS"
 * tutarsızlığı ortadan kalkar.
 *
 * `task`: görev objesi ({ id, tags }) veya geriye uyumluluk için sadece id (number).
 *
 * RENKLER: Dönemsel Modlar sayfasındaki kart renkleriyle BİREBİR aynı sabit palet
 * kullanılır (tema token'ları DEĞİL) → bir modun görev şeridi/çipi ile o modun kartı
 * her zaman aynı rengi gösterir. Eski hâlde theme.primary/secondary/... kullanıldığı
 * için spor yeşil, mülakat mor görünüp kartlarla çelişiyordu.
 */
import { localizeSporGoal } from './turkishModes';
import { swallow } from '@/shared/utils/swallow';

type TaskLike = { id: number; tags?: string[] | null };

/**
 * Bir dönemsel mod slotunun tarih türevlerini tek yerden hesaplar.
 * modlar.tsx içinde her slot (exam/exam2/exam3, mulakat×3, spor×3...) için kopyalanan
 * "gün sonu + geçti mi + kaç gün kaldı + dateObj" matematiğinin tek kaynağı.
 *
 * `labelInput`: slotun adı/hedefi (boşsa slot tamamlanmamış sayılır).
 * `fallbackDays`: tarih girilmemişse picker'ın açılacağı varsayılan ileri gün sayısı.
 */
export interface DateSlotDerived {
  isComplete: boolean;
  datePast: boolean;
  daysLeft: number;
  dateObj: Date;
}

export function deriveDateSlot(
  labelInput: string,
  dateInput: string,
  fallbackDays: number,
  now: number = Date.now(),
): DateSlotDerived {
  const isComplete = labelInput.trim() !== '' && dateInput !== '';
  const endOfDay = dateInput ? new Date(dateInput).setHours(23, 59, 59, 999) : 0;
  const datePast = dateInput ? endOfDay < now : false;
  const daysLeft = dateInput && !datePast ? Math.max(0, Math.ceil((endOfDay - now) / 86400000)) : 0;
  const dateObj = dateInput ? new Date(dateInput) : new Date(now + fallbackDays * 86400000);
  return { isComplete, datePast, daysLeft, dateObj };
}

// modlar.tsx kart paleti ile eşleşir.
const MODE_COLORS = {
  exam: '#3B82F6',
  tez: '#8B5CF6',
  mulakat: '#10B981',
  spor: '#F97316',
  ramazan: '#6366F1',
} as const;

// Etiket adlarındaki ham emoji'leri temizler (ör. preset adı "⚖️ Kilo Yönetimi").
// İkon/çip zaten flat tema ikonu gösteriyor; metinde ham emoji tutarsız durur.
const stripEmoji = (s: string) => s
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
  .replace(/\s+/g, ' ')
  .trim();

function getDaysLeft(isoDate: string | null | undefined): number | undefined {
  if (!isoDate) return undefined;
  const now = new Date();
  now.setHours(now.getHours() - 3); // 3-hour buffer
  now.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / 86400000));
}

function getCleanDays(start: string | null): number {
  if (!start) return 0;
  const s = new Date(start + 'T00:00:00').getTime();
  return Math.max(0, Math.floor((Date.now() - s) / 86400000));
}

export function getTaskRemainingTime(dueDate: string | null | undefined, dueTime: string | null | undefined, isCompleted: boolean, tr: boolean): string | null {
  if (isCompleted) return null;
  if (!dueDate) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  
  // Parse target date without timezone issues
  const targetDateOnly = new Date(dueDate);
  targetDateOnly.setHours(0, 0, 0, 0);

  const diffDays = Math.round((targetDateOnly.getTime() - todayStart.getTime()) / 86400000);

  if (diffDays < 0) {
    return tr ? 'Süresi geçti' : 'Overdue';
  }

  if (diffDays === 0) {
    if (dueTime) {
      let targetDate = new Date(dueDate);
      const timeParts = dueTime.includes('T') ? new Date(dueTime) : null;
      if (timeParts && !isNaN(timeParts.getTime())) {
        targetDate.setHours(timeParts.getHours(), timeParts.getMinutes(), 0, 0);
      } else {
        const match = dueTime.match(/(\d{2}):(\d{2})/);
        if (match) {
          targetDate.setHours(parseInt(match[1]), parseInt(match[2]), 0, 0);
        }
      }
      const diffMs = targetDate.getTime() - now.getTime();
      if (diffMs < 0) {
        return tr ? 'Süresi geçti' : 'Overdue';
      }
      const diffHrs = Math.floor(diffMs / 3600000);
      if (diffHrs < 1) {
        const mins = Math.max(1, Math.floor(diffMs / 60000));
        return tr ? `${mins} dakika kaldı` : `${mins} min left`;
      }
      return tr ? `${diffHrs} saat kaldı` : `${diffHrs} hours left`;
    }
    return tr ? 'Bugün' : 'Today';
  }

  if (diffDays === 1) {
    return tr ? 'Yarın' : 'Tomorrow';
  }

  return tr ? `${diffDays} gün kaldı` : `${diffDays} days left`;
}

export const getModeInfoForTask = (task: TaskLike | number, prefsStoreState: any, _theme?: any) => {
  const r = getModeInfoForTaskRaw(task, prefsStoreState);
  if (!r) return r;

  const taskObj = typeof task === 'number'
    ? require('@/features/tasks/store/useTaskStore').useTaskStore.getState().tasks.find((t: any) => t.id === task)
    : task;
  const tags: string[] = taskObj?.tags ?? [];

  const isQuitMode = tags.includes('birakma') || r.unit === 'clean_day';
  const isCritical = r.daysLeft !== undefined && r.daysLeft <= 45;
  const showCountdown = isQuitMode || isCritical;

  return {
    ...r,
    labelTr: stripEmoji(r.labelTr) || r.labelTr,
    labelEn: stripEmoji(r.labelEn) || r.labelEn,
    daysLeft: showCountdown ? r.daysLeft : undefined,
    unit: showCountdown ? r.unit : undefined
  };
};

const getModeInfoForTaskRaw = (task: TaskLike | number, prefsStoreState: any) => {
  const p = prefsStoreState;
  if (!p) return null;

  const taskId = typeof task === 'number' ? task : task?.id;
  const taskObj = typeof task === 'number'
    ? require('@/features/tasks/store/useTaskStore').useTaskStore.getState().tasks.find((t: any) => t.id === task)
    : task;
  const tags: string[] = taskObj?.tags ?? [];
  const has = (...ts: string[]) => ts.some(t => tags.includes(t));

  // ── SINAV (exam) ──
  if (p.exam2PlanTaskIds?.includes(taskId) || has('exam2')) {
    const dl = getDaysLeft(p.seasonal?.exam2Date);
    return { color: MODE_COLORS.exam, labelTr: p.seasonal?.exam2Name || 'Sınav Planı 2', labelEn: p.seasonal?.exam2Name || 'Exam Plan 2', daysLeft: dl, unit: 'day' };
  }
  if (p.exam3PlanTaskIds?.includes(taskId) || has('exam3')) {
    const dl = getDaysLeft(p.seasonal?.exam3Date);
    return { color: MODE_COLORS.exam, labelTr: p.seasonal?.exam3Name || 'Sınav Planı 3', labelEn: p.seasonal?.exam3Name || 'Exam Plan 3', daysLeft: dl, unit: 'day' };
  }
  if (p.examPlanTaskIds?.includes(taskId) || has('exam', 'yks', 'kpss', 'sinav_eve', 'sinav_week', 'sinav_60', 'sinav_sprint_start')) {
    const dl = getDaysLeft(p.seasonal?.examDate);
    return { color: MODE_COLORS.exam, labelTr: p.seasonal?.examName || 'Sınav Planı', labelEn: p.seasonal?.examName || 'Exam Plan', daysLeft: dl, unit: 'day' };
  }

  // ── TEZ / PROJE ──
  if (p.tezPlanTaskIds?.includes(taskId) || has('tez', 'tez_weekly', 'tez_final_2weeks', 'tez_sprint_30', 'tez_60')) {
    const dl = getDaysLeft(p.seasonal?.tezDate);
    return { color: MODE_COLORS.tez, labelTr: p.seasonal?.tezName || 'Tez/Proje', labelEn: p.seasonal?.tezName || 'Thesis', daysLeft: dl, unit: 'day' };
  }

  // ── MÜLAKAT ──
  if (p.mulakat2PlanTaskIds?.includes(taskId) || has('mulakat2')) {
    const dl = getDaysLeft(p.seasonal?.mulakat2Date);
    return { color: MODE_COLORS.mulakat, labelTr: p.seasonal?.mulakat2Name || 'Mülakat Planı 2', labelEn: p.seasonal?.mulakat2Name || 'Interview Plan 2', daysLeft: dl, unit: 'day' };
  }
  if (p.mulakat3PlanTaskIds?.includes(taskId) || has('mulakat3')) {
    const dl = getDaysLeft(p.seasonal?.mulakat3Date);
    return { color: MODE_COLORS.mulakat, labelTr: p.seasonal?.mulakat3Name || 'Mülakat Planı 3', labelEn: p.seasonal?.mulakat3Name || 'Interview Plan 3', daysLeft: dl, unit: 'day' };
  }
  if (p.mulakatPlanTaskIds?.includes(taskId) || has('mulakat', 'mulakat_day', 'mulakat_eve', 'mulakat_3days', 'mulakat_week', 'mulakat_2weeks')) {
    const dl = getDaysLeft(p.seasonal?.mulakatDate);
    return { color: MODE_COLORS.mulakat, labelTr: p.seasonal?.mulakatName || 'Mülakat Planı', labelEn: p.seasonal?.mulakatName || 'Interview Plan', daysLeft: dl, unit: 'day' };
  }

  // ── SPOR ──
  if (p.spor2PlanTaskIds?.includes(taskId) || has('spor2')) {
    const dl = getDaysLeft(p.seasonal?.spor2Date);
    return { color: MODE_COLORS.spor, labelTr: localizeSporGoal(p.seasonal?.spor2Goal || 'Spor Planı 2', true), labelEn: localizeSporGoal(p.seasonal?.spor2Goal || 'Workout Plan 2', false), daysLeft: dl, unit: 'day' };
  }
  if (p.spor3PlanTaskIds?.includes(taskId) || has('spor3')) {
    const dl = getDaysLeft(p.seasonal?.spor3Date);
    return { color: MODE_COLORS.spor, labelTr: localizeSporGoal(p.seasonal?.spor3Goal || 'Spor Planı 3', true), labelEn: localizeSporGoal(p.seasonal?.spor3Goal || 'Workout Plan 3', false), daysLeft: dl, unit: 'day' };
  }
  if (p.sporPlanTaskIds?.includes(taskId) || has('spor', 'kilo', 'maraton', 'guc', 'genel', 'kilo_adapt', 'kilo_measure', 'maraton_taper', 'maraton_race_week', 'maraton_warn', 'maraton_missed', 'maraton_progress', 'guc_deload', 'guc_progress', 'weight_entry')) {
    const dl = getDaysLeft(p.seasonal?.sporDate);
    return { color: MODE_COLORS.spor, labelTr: localizeSporGoal(p.seasonal?.sporGoal || 'Spor Planı', true), labelEn: localizeSporGoal(p.seasonal?.sporGoal || 'Workout Plan', false), daysLeft: dl, unit: 'day' };
  }

  // ── TASARRUF / BÜTÇE ──
  if (p.tasarrufPlanTaskIds?.includes(taskId) || has('tasarruf', 'budget_entry')) {
    const dl = getDaysLeft(p.seasonal?.tasarrufDate);
    return { color: '#06B6D4', labelTr: p.seasonal?.tasarrufName || 'Tasarruf', labelEn: p.seasonal?.tasarrufName || 'Savings', daysLeft: dl, unit: 'day' };
  }

  // ── BIRAKMA ──
  if (p.birakmaPlanTaskIds?.includes(taskId) || has('birakma')) {
    let daysClean = 0;
    try {
      const qStore = require('@/shared/store/useQuitStore').useQuitStore.getState();
      const item = qStore.items[0];
      if (item) {
        daysClean = getCleanDays(item.start);
      }
    } catch (e) { swallow('modeHelpers.readQuitStoreItem', e); }
    return { color: '#EF4444', labelTr: p.seasonal?.birakmaName || 'Bırakma', labelEn: p.seasonal?.birakmaName || 'Quit', daysLeft: daysClean, unit: 'clean_day' };
  }

  // ── RAMAZAN ──
  if (p.ramazanPlanTaskIds?.includes(taskId) || has('ramazan', 'ramazan_kadir')) {
    const RAMAZAN = [
      { start: '2026-02-17', end: '2026-03-19' }
    ];
    const todayStr = new Date().toISOString().slice(0, 10);
    const active = RAMAZAN.find(r => todayStr >= r.start && todayStr <= r.end) || RAMAZAN[0];
    const dl = getDaysLeft(active.end);
    return { color: MODE_COLORS.ramazan, labelTr: 'Ramazan Planı', labelEn: 'Ramadan Plan', daysLeft: dl, unit: 'day' };
  }

  return null;
};
