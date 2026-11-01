import { suggestHabitIcon } from '@/features/habits/utils/habitIcon';
import type { HabitSchedule } from '@/features/habits/utils/habitSchedule';
import { roomLeft } from '@/features/habits/utils/habitLimit';
import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { usePrefsStore, type FirstCapture, type SeasonalPrefs } from '@/features/modes/store/usePrefsStore';
import { CAPTURE_LIMITS, clampTitle, type CaptureResult, type ModeSignal } from '@/features/tasks/nlp/capture';
import type { Lang, NlpPriority } from '@/features/tasks/nlp/understand';
import { QUICK_COLORS } from '@/features/modes/utils/customPlanDraft';
import { track } from '@/shared/utils/analytics';
import { createSeedTask } from './quickStart';

/**
 * "AKLINDAKİLERİ YAZ" AKIŞI (C2–C5, 2026-10-31) — ekranın arkasındaki saf kararlar ve TEK kayıt yolu.
 *
 * ── NEREDE ────────────────────────────────────────────────────────────────────
 * Tanıtım slaytları girişten ÖNCE çalışıyor; orada yazılan görevin yazılacağı hesap henüz yok.
 * Bu yüzden ekran hoş geldinden SONRA, turdan ÖNCE açılır (welcomeStatus ile aynı kalıp: bayrak
 * diske yazılı, uygulama kapansa da kaldığı yerden). Yalnız YENİ hesaplara, bir kez.
 *
 * ── NEDEN ÖNİZLEME ŞART ───────────────────────────────────────────────────────
 * Ayrıştırıcı deterministik ve altın setle korunuyor ama yanlış anlama yine olur. Kullanıcı her
 * maddeyi görür, düzeltir, çıkarır ya da görev ↔ alışkanlık değiştirir; "Planıma ekle" ondan sonra.
 */

export interface CaptureDraft {
  id: string;
  kind: 'task' | 'habit';
  title: string;
  /** Kararı doğuran kelimeler ("yarın", "her sabah") — önizlemede küçük yazıyla. */
  evidence: string[];
  dueDate?: string;
  dueTime?: string;
  priority?: NlpPriority;
  recurrence?: 'Monthly';
  schedule?: HabitSchedule;
  emoji?: string | null;
}

export function toDrafts(result: CaptureResult): CaptureDraft[] {
  return result.items.map((it, i) => (it.kind === 'habit'
    ? { id: `c${i}`, kind: 'habit', title: it.title, evidence: it.evidence, schedule: it.schedule, emoji: it.emoji }
    : {
      id: `c${i}`, kind: 'task', title: it.title, evidence: it.evidence,
      dueDate: it.dueDate, dueTime: it.dueTime, priority: it.priority, recurrence: it.recurrence,
    }));
}

/** En olası yanlış anlama görev ↔ alışkanlık: tek dokunuşla değişir. */
export function toggleKind(d: CaptureDraft, lang: Lang): CaptureDraft {
  if (d.kind === 'task') {
    // Alışkanlık adı sınırı (40) görevinkinden (100) kısa: türü değişen başlık kelime sınırından kısalır.
    const title = clampTitle(d.title, CAPTURE_LIMITS.habitTitle);
    return { id: d.id, kind: 'habit', title, evidence: d.evidence, schedule: { kind: 'daily' }, emoji: suggestHabitIcon(title, lang) };
  }
  return { id: d.id, kind: 'task', title: d.title, evidence: d.evidence };
}

/** Kabul edilen modun tercihe yazılacak alanları. Tarih yalnız tarih alanı olan modlarda. */
const MODE_FIELDS: Record<ModeSignal['mode'], { flag: keyof SeasonalPrefs; date?: keyof SeasonalPrefs }> = {
  exam: { flag: 'examMode', date: 'examDate' },
  tez: { flag: 'tezMode', date: 'tezDate' },
  mulakat: { flag: 'mulakatMode', date: 'mulakatDate' },
  spor: { flag: 'sporMode', date: 'sporDate' },
  tasarruf: { flag: 'tasarrufMode', date: 'tasarrufDate' },
  birakma: { flag: 'birakmaMode' },
  ramazan: { flag: 'ramazan' },
};

export function modePatch(m: ModeSignal): Partial<Record<keyof SeasonalPrefs, boolean | string>> {
  const f = MODE_FIELDS[m.mode];
  return { [f.flag]: true, ...(f.date && m.date ? { [f.date]: m.date } : {}) };
}

export function shouldOfferCapture(p: { capturePending: boolean; welcomeStatus: string; firstCapture: FirstCapture | null }): boolean {
  return p.capturePending && p.welcomeStatus === 'done' && !p.firstCapture;
}

/**
 * Tek kayıt yolu. Görevler `createSeedTask` ile (çevrimdışı ve misafirde kuyruğa düşer — bkz.
 * quickStart). Alışkanlıklar sınırı (HABIT_LIMIT) aşmaz: sığmayan madde GÖREV olarak eklenir,
 * kullanıcının yazdığı hiçbir şey kaybolmaz. Ölçüm (firstCapture) yalnız sayı ve enum.
 */
export async function applyCapture(input: {
  drafts: CaptureDraft[];
  lang: Lang;
  mode?: ModeSignal;
  acceptMode: boolean;
  skipped?: boolean;
}): Promise<{ tasks: number; habits: number }> {
  const prefs = usePrefsStore.getState();
  let tasks = 0;
  let habits = 0;
  if (!input.skipped) {
    let room = roomLeft(useHabitStore.getState().habits);
    for (const d of input.drafts) {
      const title = d.title.trim();
      if (!title) continue;
      if (d.kind === 'habit' && room > 0) {
        const color = QUICK_COLORS[habits % QUICK_COLORS.length];
        useHabitStore.getState().addHabit(title, d.emoji ?? '✨', color, undefined, undefined, undefined, undefined,
          d.schedule ? { schedule: d.schedule } : undefined);
        room--;
        habits++;
        continue;
      }
      await createSeedTask({
        title,
        description: '',
        dueDate: d.kind === 'task' ? d.dueDate ?? null : null,
        dueTime: d.kind === 'task' ? d.dueTime ?? null : null,
        priority: d.priority ?? 'Medium',
        recurrence: d.recurrence ?? 'None',
        isCompleted: false,
        tags: [],
      });
      tasks++;
    }
    if (input.mode && input.acceptMode) {
      for (const [k, v] of Object.entries(modePatch(input.mode))) prefs.setSeasonalPref(k as keyof SeasonalPrefs, v as boolean | string);
    }
  }
  prefs.recordFirstCapture({
    result: input.skipped ? 'skipped' : 'wrote',
    items: tasks + habits,
    habits,
    modeSuggested: input.mode?.mode ?? null,
    modeAccepted: !!(input.mode && input.acceptMode && !input.skipped),
  });
  prefs.setCapturePending(false);
  track('onboarding_step', { step: 'capture', result: input.skipped ? 'skipped' : 'wrote', items: tasks + habits });
  return { tasks, habits };
}
