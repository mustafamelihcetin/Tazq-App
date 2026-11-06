/* PLAN GÖREVİ ANAHTARLARI: aynı plan görevi iki kez oluşmasın (sunucu aynı açık anahtarı reddeder; bkz. TaskService.createTask). */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
const doubleHash = (s: string) => `${fnv1a(s)}${fnv1a(s.split('').reverse().join(''))}`;

function dayOf(date?: string | null): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

/** Deterministik idempotency anahtarı: aynı (etiketler|gün|başlık) için aynı sonuç, sunucu çift kaydı reddeder (≤ 64 karakter). */
export function makeClientKey(payload: { title: string; dueDate?: string | null; tags?: string[] | null }): string {
  const tags = (payload.tags ?? []).slice().sort().join(',');
  const day = dayOf(payload.dueDate);
  return `${day}:${doubleHash(`${tags}|${day}|${payload.title.trim().toLocaleLowerCase('tr')}`)}`.slice(0, 64);
}

/** Sıradaki plan öğesinin anahtarı: gün ve dilden bağımsız, öğe kaç gün denenirse denensin aynı. */
export function stagedTaskKey(slot: string, titleTr: string): string {
  return `s-${slot}-${doubleHash(titleTr.trim().toLocaleLowerCase('tr'))}`.slice(0, 64);
}

/** Plan üretimi görevlerin ham etiketleri ("bu görev bizim mi?"; bkz. planTaskOps). */
export const PLAN_TAGS = [
  'exam', 'exam2', 'exam3', 'tez', 'mulakat', 'mulakat2', 'mulakat3',
  'spor', 'spor2', 'spor3', 'ramazan', 'yks', 'kpss', 'daily', 'tasarruf', 'birakma',
];

/** Plan görevlerinin açıklaması iki dilli JSON; kullanıcının yazdığı açıklama böyle başlamaz. Etiket çevrilse de bu kalır. */
export const hasPlanDescription = (description?: string | null): boolean => (description ?? '').startsWith('{"tr":');

/**
 * SON KAPI: anahtarı unutulmuş plan görevi de çift oluşamaz. Kullanıcının görevine dokunulmaz: aynı adla iki görev yazması serbesttir.
 */
export function withPlanKey<T extends { title: string; description?: string | null; dueDate?: string | null; tags?: string[] | null; clientKey?: string }>(payload: T): T {
  if (payload.clientKey) return payload;
  const planned = hasPlanDescription(payload.description) || (payload.tags ?? []).some((t) => PLAN_TAGS.includes(t));
  return planned ? { ...payload, clientKey: makeClientKey(payload) } : payload;
}
