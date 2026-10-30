import type { Habit } from '@/features/habits/store/useHabitStore';

/*
  ALIŞKANLIK EŞİTLEMESİ — yerel ve bulut kopyanın birleşmesi (bkz. __tests__/habitsMerge.test.ts).

  Kural: hiçbir taraftaki bir işaret KAYBOLMAZ.
   · Kimliğe göre birleşir; yalnız bir tarafta olan alışkanlık korunur.
   · Yapılan ve mola günleri BİRLEŞİR (iki cihazda ayrı günler işaretlenmiş olabilir).
     Aynı gün hem yapıldı hem molaysa "yapıldı" kazanır.
   · Ad/simge/renk yerel kopyadan: bu cihazdaki son düzenleme.
   · En eski oluşturulma tarihi korunur — seri ve oran paydası ona dayanır.

  Bilinen ve kabul edilen sınır: bir cihazda geri alınan işaret, öteki cihazda hâlâ duruyorsa
  birleşmede geri gelir. Kaybolan işaret, fazladan kalan işaretten çok daha pahalıdır.
*/

const uniqSorted = (xs: string[]) => Array.from(new Set(xs.filter((x) => typeof x === 'string'))).sort();

function combine(local: Habit, cloud: Habit): Habit {
  const completed = uniqSorted([...(local.completedDates ?? []), ...(cloud.completedDates ?? [])]);
  const done = new Set(completed);
  const skipped = uniqSorted([...(local.skippedDates ?? []), ...(cloud.skippedDates ?? [])]).filter((d) => !done.has(d));
  const createdAt = [local.createdAt, cloud.createdAt].filter(Boolean).sort()[0] ?? local.createdAt;
  // Miktar sayaçları: gün başına BÜYÜK olan kazanır (iki cihazda ayrı ayrı dokunulmuş olabilir).
  const counts: Record<string, number> = { ...(cloud.counts ?? {}) };
  for (const [k, v] of Object.entries(local.counts ?? {})) counts[k] = Math.max(counts[k] ?? 0, v);
  return { ...cloud, ...local, completedDates: completed, skippedDates: skipped, createdAt, ...(Object.keys(counts).length ? { counts } : {}) };
}

export function mergeHabits(local: Habit[], cloud: Habit[]): Habit[] {
  const validCloud = cloud.filter((c) => c && typeof c.id === 'string' && c.id.length > 0);
  if (validCloud.length === 0) return local;
  if (local.length === 0) return validCloud;
  const byId = new Map(validCloud.map((c) => [c.id, c]));
  const merged = local.map((l) => (byId.has(l.id) ? combine(l, byId.get(l.id)!) : l));
  const localIds = new Set(local.map((l) => l.id));
  for (const c of validCloud) if (!localIds.has(c.id)) merged.push(c);
  return merged;
}

/** Sunucudan gelen JSON → alışkanlık dizisi. Boş/bozuk/dizi değilse null: yerel ASLA ezilmez. */
export function parseCloudHabits(json: string | null | undefined): Habit[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((x) => x && typeof x === 'object' && typeof x.id === 'string')
      .map((x) => ({
        ...x,
        completedDates: Array.isArray(x.completedDates) ? x.completedDates : [],
        skippedDates: Array.isArray(x.skippedDates) ? x.skippedDates : [],
      }));
  } catch {
    return null;
  }
}
