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

export const getModeInfoForTask = (task: TaskLike | number, prefsStoreState: any, _theme?: any) => {
  const r = getModeInfoForTaskRaw(task, prefsStoreState);
  if (!r) return r;
  return { ...r, labelTr: stripEmoji(r.labelTr) || r.labelTr, labelEn: stripEmoji(r.labelEn) || r.labelEn };
};

const getModeInfoForTaskRaw = (task: TaskLike | number, prefsStoreState: any) => {
  const p = prefsStoreState;
  if (!p) return null;

  const taskId = typeof task === 'number' ? task : task?.id;
  const tags: string[] = typeof task === 'number' ? [] : (task?.tags ?? []);
  const has = (...ts: string[]) => ts.some(t => tags.includes(t));

  // ── SINAV (exam) ── slot 2/3 önce (daha spesifik), sonra slot 1 + grup tag'leri
  if (p.exam2PlanTaskIds?.includes(taskId) || has('exam2'))
    return { color: MODE_COLORS.exam, labelTr: p.seasonal?.exam2Name || 'Sınav Planı 2', labelEn: p.seasonal?.exam2Name || 'Exam Plan 2' };
  if (p.exam3PlanTaskIds?.includes(taskId) || has('exam3'))
    return { color: MODE_COLORS.exam, labelTr: p.seasonal?.exam3Name || 'Sınav Planı 3', labelEn: p.seasonal?.exam3Name || 'Exam Plan 3' };
  if (p.examPlanTaskIds?.includes(taskId) || has('exam', 'yks', 'kpss', 'sinav_eve', 'sinav_week', 'sinav_60', 'sinav_sprint_start'))
    return { color: MODE_COLORS.exam, labelTr: p.seasonal?.examName || 'Sınav Planı', labelEn: p.seasonal?.examName || 'Exam Plan' };

  // ── TEZ / PROJE ──
  if (p.tezPlanTaskIds?.includes(taskId) || has('tez', 'tez_weekly', 'tez_final_2weeks', 'tez_sprint_30', 'tez_60'))
    return { color: MODE_COLORS.tez, labelTr: p.seasonal?.tezName || 'Tez/Proje', labelEn: p.seasonal?.tezName || 'Thesis' };

  // ── MÜLAKAT ──
  if (p.mulakat2PlanTaskIds?.includes(taskId) || has('mulakat2'))
    return { color: MODE_COLORS.mulakat, labelTr: p.seasonal?.mulakat2Name || 'Mülakat Planı 2', labelEn: p.seasonal?.mulakat2Name || 'Interview Plan 2' };
  if (p.mulakat3PlanTaskIds?.includes(taskId) || has('mulakat3'))
    return { color: MODE_COLORS.mulakat, labelTr: p.seasonal?.mulakat3Name || 'Mülakat Planı 3', labelEn: p.seasonal?.mulakat3Name || 'Interview Plan 3' };
  if (p.mulakatPlanTaskIds?.includes(taskId) || has('mulakat', 'mulakat_day', 'mulakat_eve', 'mulakat_3days', 'mulakat_week', 'mulakat_2weeks'))
    return { color: MODE_COLORS.mulakat, labelTr: p.seasonal?.mulakatName || 'Mülakat Planı', labelEn: p.seasonal?.mulakatName || 'Interview Plan' };

  // ── SPOR ──
  if (p.spor2PlanTaskIds?.includes(taskId) || has('spor2'))
    return { color: MODE_COLORS.spor, labelTr: localizeSporGoal(p.seasonal?.spor2Goal || 'Spor Planı 2', true), labelEn: localizeSporGoal(p.seasonal?.spor2Goal || 'Workout Plan 2', false) };
  if (p.spor3PlanTaskIds?.includes(taskId) || has('spor3'))
    return { color: MODE_COLORS.spor, labelTr: localizeSporGoal(p.seasonal?.spor3Goal || 'Spor Planı 3', true), labelEn: localizeSporGoal(p.seasonal?.spor3Goal || 'Workout Plan 3', false) };
  if (p.sporPlanTaskIds?.includes(taskId) || has('spor', 'kilo', 'maraton', 'guc', 'genel', 'kilo_adapt', 'kilo_measure', 'maraton_taper', 'maraton_race_week', 'maraton_warn', 'maraton_missed', 'maraton_progress', 'guc_deload', 'guc_progress'))
    return { color: MODE_COLORS.spor, labelTr: localizeSporGoal(p.seasonal?.sporGoal || 'Spor Planı', true), labelEn: localizeSporGoal(p.seasonal?.sporGoal || 'Workout Plan', false) };

  // ── TASARRUF / BÜTÇE ──
  if (p.tasarrufPlanTaskIds?.includes(taskId) || has('tasarruf', 'budget_entry'))
    return { color: '#06B6D4', labelTr: p.seasonal?.tasarrufName || 'Tasarruf', labelEn: p.seasonal?.tasarrufName || 'Savings' };

  // ── BIRAKMA ──
  if (p.birakmaPlanTaskIds?.includes(taskId) || has('birakma'))
    return { color: '#EF4444', labelTr: p.seasonal?.birakmaName || 'Bırakma', labelEn: p.seasonal?.birakmaName || 'Quit' };

  // ── RAMAZAN ──
  if (p.ramazanPlanTaskIds?.includes(taskId) || has('ramazan', 'ramazan_kadir'))
    return { color: MODE_COLORS.ramazan, labelTr: 'Ramazan Planı', labelEn: 'Ramadan Plan' };

  return null;
};
