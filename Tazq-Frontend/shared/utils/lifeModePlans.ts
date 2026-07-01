/**
 * Tasarruf/Bütçe ve Bırakma modlarının kural-tabanlı (AI'sız) plan içerikleri.
 * "Uygula" anında oluşturulacak başlangıç alışkanlık + görevleri ve dönemsel
 * (haftalık tartım / milestone) üretim yardımcıları burada toplanır.
 */
import type { BudgetType } from '@/shared/store/useBudgetStore';
import type { QuitType } from '@/shared/store/useQuitStore';

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

// Tipe özel günlük alışkanlık — her bütçe hedefi farklı bir günlük davranışı pekiştirir.
const TASARRUF_TYPE_HABITS: Record<Exclude<BudgetType, ''>, ModeDraftHabit> = {
  birikim: { name: 'Bugün hedefe katkı yaptım', nameEn: 'Contributed toward my goal today', emoji: '💰', color: TASARRUF_COLOR },
  borc: { name: 'Bugün borca ödeme/ayırma yaptım', nameEn: 'Paid/set aside toward debt today', emoji: '💳', color: TASARRUF_COLOR },
  acilfon: { name: 'Acil fona dokunmadım', nameEn: "Didn't touch the emergency fund", emoji: '🛡️', color: TASARRUF_COLOR },
};

const TASARRUF_BASE_TASKS: ModeDraftTask[] = [
  { title: 'Otomatik birikim talimatı kur', titleEn: 'Set up an automatic transfer', priority: 'High', tags: ['tasarruf'] },
  { title: '50/30/20 bütçe kuralını uygula', titleEn: 'Apply the 50/30/20 budget rule', priority: 'Medium', tags: ['tasarruf'] },
  { title: 'Gereksiz abonelikleri iptal et', titleEn: 'Cancel unused subscriptions', priority: 'Medium', tags: ['tasarruf'] },
];

// Tipe özel görevler (2 adet) — genel kalıbı değil, o hedefin gerçek ilk adımlarını verir.
const TASARRUF_TYPE_TASKS: Record<Exclude<BudgetType, ''>, ModeDraftTask[]> = {
  birikim: [
    { title: 'Aylık birikim tutarını belirle', titleEn: 'Decide your monthly saving amount', priority: 'High', tags: ['tasarruf'] },
    { title: 'Birikim için ayrı bir hesap aç', titleEn: 'Open a separate account for savings', priority: 'Medium', tags: ['tasarruf'] },
  ],
  borc: [
    { title: 'Borç ödeme planı çıkar (kartopu/çığ)', titleEn: 'Make a payoff plan (snowball/avalanche)', priority: 'High', tags: ['tasarruf'] },
    { title: 'En yüksek faizli borcu önceliklendir', titleEn: 'Prioritize the highest-interest debt', priority: 'Medium', tags: ['tasarruf'] },
  ],
  acilfon: [
    { title: 'Acil fon hedefini belirle (3-6 aylık gider)', titleEn: 'Set emergency fund target (3-6 mo. expenses)', priority: 'High', tags: ['tasarruf'] },
    { title: 'Acil fon için ayrı/erişimi zor bir hesap aç', titleEn: 'Open a separate, hard-to-reach account', priority: 'Medium', tags: ['tasarruf'] },
  ],
};

export function buildTasarrufPlan(type: BudgetType): ModePlanContent {
  const habits = TASARRUF_BASE_HABITS.map(h => ({ ...h }));
  const tasks = [...TASARRUF_BASE_TASKS];
  if (type && TASARRUF_TYPE_HABITS[type as Exclude<BudgetType, ''>]) {
    habits.push({ ...TASARRUF_TYPE_HABITS[type as Exclude<BudgetType, ''>] });
  }
  if (type && TASARRUF_TYPE_TASKS[type as Exclude<BudgetType, ''>]) {
    // Tipe özel görevler en başa (en alakalı ilk adımlar üstte görünsün).
    tasks.unshift(...TASARRUF_TYPE_TASKS[type as Exclude<BudgetType, ''>]);
  }
  return { habits, tasks };
}

// ── BIRAKMA ─────────────────────────────────────────────────────────────────
const BIRAKMA_BASE_HABITS: ModeDraftHabit[] = [
  { name: 'Bugün temiz kaldım', nameEn: 'Stayed clean today', emoji: '🛡️', color: BIRAKMA_COLOR },
  { name: 'Tetikleyiciden uzak dur', nameEn: 'Avoid triggers', emoji: '🚫', color: BIRAKMA_COLOR },
  { name: 'Nefes / su molası', nameEn: 'Breathe / water break', emoji: '💧', color: BIRAKMA_COLOR },
];

const BIRAKMA_BASE_TASKS: ModeDraftTask[] = [
  { title: 'Tetikleyicilerini yaz', titleEn: 'Write down your triggers', priority: 'High', tags: ['birakma'] },
  { title: 'İlk 3 günün planını yap (en zor dönem)', titleEn: 'Plan your first 3 days (the hardest)', priority: 'High', tags: ['birakma'] },
  { title: 'Destek olacak birine durumunu söyle', titleEn: 'Tell someone who can support you', priority: 'Medium', tags: ['birakma'] },
  { title: 'Kendine bir ödül belirle', titleEn: 'Choose a reward for yourself', priority: 'Low', tags: ['birakma'] },
];

// Tipe özel görevler (2 adet) — bırakılan şeye göre somut çevresel adımlar.
const BIRAKMA_TYPE_TASKS: Partial<Record<Exclude<QuitType, ''>, ModeDraftTask[]>> = {
  sigara: [
    { title: 'Sigara parasını ayrı bir kavanoza/hesaba ayır', titleEn: 'Stash your cigarette money separately', priority: 'Medium', tags: ['birakma'] },
    { title: 'Sigarayı çağrıştıran eşyaları kaldır (kül tablası, çakmak)', titleEn: 'Remove smoking cues (ashtray, lighter)', priority: 'Medium', tags: ['birakma'] },
  ],
  sosyal: [
    { title: 'Uygulamalara günlük kullanım limiti koy', titleEn: 'Set daily app usage limits', priority: 'Medium', tags: ['birakma'] },
    { title: 'Bildirimleri kapat ve uygulamayı ana ekrandan kaldır', titleEn: 'Mute notifications and remove app from home screen', priority: 'Medium', tags: ['birakma'] },
  ],
  seker: [
    { title: 'Şekerli içecekleri evden çıkar', titleEn: 'Remove sugary drinks from home', priority: 'Medium', tags: ['birakma'] },
    { title: 'Sağlıklı atıştırmalık alternatifleri hazırla', titleEn: 'Prep healthy snack alternatives', priority: 'Medium', tags: ['birakma'] },
  ],
  alkol: [
    { title: 'Alkolsüz alternatifler hazır bulundur', titleEn: 'Keep alcohol-free alternatives ready', priority: 'Medium', tags: ['birakma'] },
    { title: 'Tetikleyici ortamlardan bu hafta uzak dur', titleEn: 'Avoid trigger settings this week', priority: 'Medium', tags: ['birakma'] },
  ],
  kumar: [
    { title: 'Bahis uygulamalarını sil ve engelle', titleEn: 'Delete and block betting apps', priority: 'High', tags: ['birakma'] },
    { title: 'Hesaplarına para girişini sınırla/dondur', titleEn: 'Limit/freeze deposits to your accounts', priority: 'High', tags: ['birakma'] },
  ],
};

// Bir bırakma türünün yalnızca TİPE ÖZEL görevleri (paylaşılan temel plana eklenir).
export function birakmaTypeTasks(type: QuitType): ModeDraftTask[] {
  const extra = type ? BIRAKMA_TYPE_TASKS[type as Exclude<QuitType, ''>] : undefined;
  return extra ? extra.map(t => ({ ...t })) : [];
}

export function buildBirakmaPlan(type: QuitType): ModePlanContent {
  const tasks = [...BIRAKMA_BASE_TASKS, ...birakmaTypeTasks(type)];
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
