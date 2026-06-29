/**
 * Tasarruf/Bütçe ve Bırakma modlarının kural-tabanlı (AI'sız) plan içerikleri.
 * "Uygula" anında oluşturulacak başlangıç alışkanlık + görevleri ve dönemsel
 * (haftalık tartım / milestone) üretim yardımcıları burada toplanır.
 */
import type { BudgetType } from '../store/useBudgetStore';
import type { QuitType } from '../store/useQuitStore';

export const TASARRUF_COLOR = '#06B6D4';
export const BIRAKMA_COLOR = '#EF4444';

export interface ModeDraftHabit { name: string; nameEn: string; emoji: string; color: string; }
export interface ModeDraftTask { title: string; titleEn: string; priority: 'High' | 'Medium' | 'Low'; tags: string[]; }
export interface ModePlanContent { habits: ModeDraftHabit[]; tasks: ModeDraftTask[]; }

// ── TASARRUF / BÜTÇE ────────────────────────────────────────────────────────
const TASARRUF_BASE_HABITS: ModeDraftHabit[] = [
  { name: 'Günlük harcama kaydı', nameEn: 'Log daily spending', emoji: '🧾', color: TASARRUF_COLOR },
  { name: 'Haftalık bütçe gözden geçir', nameEn: 'Weekly budget review', emoji: '📊', color: TASARRUF_COLOR },
];

const TASARRUF_BASE_TASKS: ModeDraftTask[] = [
  { title: 'Otomatik birikim talimatı kur', titleEn: 'Set up an automatic transfer', priority: 'High', tags: ['tasarruf'] },
  { title: 'Gereksiz abonelikleri iptal et', titleEn: 'Cancel unused subscriptions', priority: 'Medium', tags: ['tasarruf'] },
];

const TASARRUF_TYPE_TASKS: Record<Exclude<BudgetType, ''>, ModeDraftTask> = {
  birikim: { title: 'Aylık birikim tutarını belirle', titleEn: 'Decide your monthly saving amount', priority: 'High', tags: ['tasarruf'] },
  borc: { title: 'Borç ödeme planı çıkar (kartopu/çığ)', titleEn: 'Make a payoff plan (snowball/avalanche)', priority: 'High', tags: ['tasarruf'] },
  acilfon: { title: 'Acil fon hedefini belirle (3-6 aylık gider)', titleEn: 'Set emergency fund target (3-6 mo. expenses)', priority: 'High', tags: ['tasarruf'] },
};

export function buildTasarrufPlan(type: BudgetType): ModePlanContent {
  const tasks = [...TASARRUF_BASE_TASKS];
  if (type && TASARRUF_TYPE_TASKS[type as Exclude<BudgetType, ''>]) {
    tasks.unshift(TASARRUF_TYPE_TASKS[type as Exclude<BudgetType, ''>]);
  }
  return { habits: TASARRUF_BASE_HABITS.map(h => ({ ...h })), tasks };
}

// ── BIRAKMA ─────────────────────────────────────────────────────────────────
const BIRAKMA_BASE_HABITS: ModeDraftHabit[] = [
  { name: 'Bugün temiz kaldım', nameEn: 'Stayed clean today', emoji: '🛡️', color: BIRAKMA_COLOR },
  { name: 'Tetikleyiciden uzak dur', nameEn: 'Avoid triggers', emoji: '🚫', color: BIRAKMA_COLOR },
  { name: 'Nefes / su molası', nameEn: 'Breathe / water break', emoji: '💧', color: BIRAKMA_COLOR },
];

const BIRAKMA_BASE_TASKS: ModeDraftTask[] = [
  { title: 'Tetikleyicilerini yaz', titleEn: 'Write down your triggers', priority: 'High', tags: ['birakma'] },
  { title: 'Kendine bir ödül belirle', titleEn: 'Choose a reward for yourself', priority: 'Low', tags: ['birakma'] },
];

const BIRAKMA_TYPE_TASKS: Partial<Record<Exclude<QuitType, ''>, ModeDraftTask>> = {
  sigara: { title: 'Sigara parasını ayrı bir kavanoza/hesaba ayır', titleEn: 'Stash your cigarette money separately', priority: 'Medium', tags: ['birakma'] },
  sosyal: { title: 'Uygulamalara günlük kullanım limiti koy', titleEn: 'Set daily app usage limits', priority: 'Medium', tags: ['birakma'] },
  seker: { title: 'Şekerli içecekleri evden çıkar', titleEn: 'Remove sugary drinks from home', priority: 'Medium', tags: ['birakma'] },
  alkol: { title: 'Alkolsüz alternatifler hazır bulundur', titleEn: 'Keep alcohol-free alternatives ready', priority: 'Medium', tags: ['birakma'] },
  kumar: { title: 'Bahis uygulamalarını sil ve engelle', titleEn: 'Delete and block betting apps', priority: 'High', tags: ['birakma'] },
};

export function buildBirakmaPlan(type: QuitType): ModePlanContent {
  const tasks = [...BIRAKMA_BASE_TASKS];
  const extra = type ? BIRAKMA_TYPE_TASKS[type as Exclude<QuitType, ''>] : undefined;
  if (extra) tasks.unshift(extra);
  return { habits: BIRAKMA_BASE_HABITS.map(h => ({ ...h })), tasks };
}

// Bırakma kilometre taşı kutlama görevi (Stage 5 günlük üretimde kullanılır).
export function birakmaMilestoneTask(days: number, tr: boolean): ModeDraftTask {
  return {
    title: tr ? `🎉 ${days}. gün! Bu seriyi koru` : `🎉 Day ${days}! Keep the streak`,
    titleEn: `🎉 Day ${days}! Keep the streak`,
    priority: 'Low',
    tags: ['birakma', `birakma_m${days}`],
  };
}

// İnsan-okur tip etiketleri.
export function tasarrufTypeLabel(type: BudgetType, tr: boolean): string {
  const map: Record<string, [string, string]> = {
    birikim: ['Birikim Hedefi', 'Savings Goal'],
    borc: ['Borç Kapatma', 'Debt Payoff'],
    acilfon: ['Acil Fon', 'Emergency Fund'],
  };
  const e = map[type]; return e ? (tr ? e[0] : e[1]) : (tr ? 'Tasarruf' : 'Savings');
}

export function birakmaTypeLabel(type: QuitType, tr: boolean): string {
  const map: Record<string, [string, string]> = {
    sigara: ['Sigara', 'Smoking'],
    sosyal: ['Sosyal Medya', 'Social Media'],
    seker: ['Şeker', 'Sugar'],
    alkol: ['Alkol', 'Alcohol'],
    kumar: ['Kumar / Bahis', 'Gambling'],
    ozel: ['Özel', 'Custom'],
  };
  const e = map[type]; return e ? (tr ? e[0] : e[1]) : (tr ? 'Bırakma' : 'Quit');
}
