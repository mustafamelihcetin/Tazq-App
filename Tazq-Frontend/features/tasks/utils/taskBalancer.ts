import { calendarDayOf, parseDateKey, toDateKey } from '@/shared/utils/dateKey';

/**
 * TAZQZen — birikmiş ve taşan işi önümüzdeki günlere DENGELİ dağıtan motor.
 *
 * Bu dosya SAF: mağazaya, ağa, bildirime dokunmaz. Yalnız "hangi görev hangi güne"
 * sorusunu cevaplar. Uygulama tarafı ayrı (bkz. rebalanceActions.ts). Ayrılmasının
 * sebebi ölçülmüş bir kusur: önceki hâlinde karar ile yan etki iç içeydi ve motorun
 * iki ana kuralı da gerçek veride SESSİZCE çalışmıyordu — kimse fark etmedi, çünkü
 * test edilebilir bir yüzeyi yoktu.
 *
 * ── ÖNCEKİ HÂLİN ÖLÇÜLEN KUSURLARI ──────────────────────────────────────────────
 *  1. Tarihler `'2026-09-19'` sanılıyordu; sunucudan `'2026-09-19T00:00:00Z'` geliyor.
 *     `'…T00:00:00Z'.split('-')` üçüncü parçayı `NaN` yapıyor → "kaç gün gecikti"
 *     NaN → 10 gün gecikmiş görev rafa alınmak yerine YARINA konuyordu.
 *  2. Aynı sebeple günlerin mevcut yükü hep 0 sayılıyordu (`'…T00:00:00Z' === '…-20'`
 *     asla doğru değil) → yarında zaten 8 görev varken taşınan iş yine yarına gidiyor,
 *     "günde en fazla 5" sözü hiç tutulmuyordu.
 *  3. Plan (mod) görevleri de taşınıyordu. Plan motoru "bugün üretildi mi" sorusunu
 *     görevin TARİHİNE bakarak cevaplıyor (bkz. dailyPlanEngine.hasDailyToday):
 *     bugünün plan görevi yarına gidince motor bugünü boş sanıp AYNI görevleri yeniden
 *     üretiyordu. Uygulama bu yüzden plan görevlerinin arşivlenmesini zaten yasaklıyor;
 *     dengeleme o kuralı atlıyordu.
 *
 * ── KURAL SETİ ──────────────────────────────────────────────────────────────────
 *  · TAŞINABİLİR görev: tamamlanmamış, arşivlenmemiş, plan görevi değil, geçerli bir
 *    tarihi var. Plan görevleri planıyla birlikte ilerler; dokunulmaz.
 *  · YÜK: bir günün yükü o güne yazılmış tamamlanmamış TÜM görevler (plan dahil) +
 *    plan motorunun o gün üreteceği tahmini görev sayısı. Motor görevleri gününde
 *    üretiyor, önceden değil — sayılmazsa gelecek günler olduğundan boş görünür ve
 *    kapasite yine taşar.
 *  · KAPASİTE: günde en fazla 5 görev.
 *  · SIRA: önce yüksek öncelik, sonra en eski tarih. İlk seçen en uygun günü alır.
 *  · YER: kapasitesi olan en boş gün; eşitlikte en yakın gün.
 *  · BELKİ BİR GÜN: 3 günden fazla gecikmiş iş rafa alınır — YÜKSEK ÖNCELİK HARİÇ
 *    (önemli bir iş yaşlandığı için gözden kaldırılmaz). Önümüzdeki 7 günde yer
 *    bulamayan iş de rafa gider: yerleştirmek yerine taşırmak, sorunu bir haftaya
 *    ertelemekten başka bir şey değil.
 */

export const DAILY_CAPACITY = 5;
export const HORIZON_DAYS = 7;
export const STALE_AFTER_DAYS = 3;

/** Plan motorunun ürettiği görevleri tanıyan etiketler (bkz. dailyPlanEngine). */
export const PLAN_TAGS = [
  'daily', 'exam', 'exam2', 'exam3', 'tez', 'mulakat', 'mulakat2', 'mulakat3',
  'spor', 'spor2', 'spor3', 'ramazan', 'yks', 'kpss', 'tasarruf', 'birakma', 'weight_entry',
];

export interface BalancerTask {
  id: number;
  title?: string;
  isCompleted: boolean;
  isArchived?: boolean;
  priority?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  tags?: string[] | null;
}

export interface BalancerOptions {
  /**
   * Bu görev plan motoruna mı ait? Varsayılan yalnız etiketlere bakar; ekran tarafı
   * mod bilgisini (getModeInfoForTask) ve başlıktan tanınan kilo görevini ekler.
   * Dışarıdan veriliyor ki motor mod mağazasına bağlanmasın ve saf kalsın.
   */
  isPlanTask?: (task: BalancerTask) => boolean;
  now?: Date;
}

export interface LoadAnalysis {
  todayKey: string;
  /** Gecikmiş TÜM görevler (plan dahil) — kullanıcıya dürüst sayı vermek için. */
  overdue: BalancerTask[];
  /** Dengelenebilecek gecikmiş görevler. */
  movableOverdue: BalancerTask[];
  /** Bugüne yazılmış tamamlanmamış TÜM görevlerin sayısı (plan dahil). */
  todayLoad: number;
  /** Bugüne yazılmış, taşınabilir görevler. */
  movableToday: BalancerTask[];
}

/** Bir hamle: görev hangi güne gidiyor — `null` "Belki Bir Gün" demek. */
export interface Move {
  task: BalancerTask;
  to: string | null;
}

export interface RebalancePlan {
  moves: Move[];
  /** Bir güne yerleştirilen görev sayısı. */
  scheduled: number;
  /** "Belki Bir Gün"e alınan görev sayısı. */
  someday: number;
}

const defaultIsPlanTask = (t: BalancerTask) => (t.tags ?? []).some((tag) => PLAN_TAGS.includes(tag));

const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const rankOf = (t: BalancerTask) => PRIORITY_RANK[t.priority ?? 'Medium'] ?? 1;

/** İki takvim günü arasındaki gün farkı (b − a). Yaz saati geçişinde yuvarlanır. */
function daysBetweenKeys(a: string, b: string): number {
  return Math.round((parseDateKey(b).getTime() - parseDateKey(a).getTime()) / 86400000);
}

function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Görevin dengelemeye girebilir olup olmadığı. */
export function isMovable(task: BalancerTask, opts: BalancerOptions = {}): boolean {
  if (!task || task.isCompleted || task.isArchived) return false;
  if (!calendarDayOf(task.dueDate)) return false;
  return !(opts.isPlanTask ?? defaultIsPlanTask)(task);
}

/** Yükün ve dengelenebilir işin anlık fotoğrafı. */
export function analyzeLoad(tasks: BalancerTask[], opts: BalancerOptions = {}): LoadAnalysis {
  const todayKey = toDateKey(opts.now ?? new Date());
  const overdue: BalancerTask[] = [];
  const movableOverdue: BalancerTask[] = [];
  const movableToday: BalancerTask[] = [];
  let todayLoad = 0;

  for (const t of tasks) {
    if (!t || t.isCompleted || t.isArchived) continue;
    const day = calendarDayOf(t.dueDate);
    if (!day) continue;
    const movable = isMovable(t, opts);
    if (day < todayKey) {
      overdue.push(t);
      if (movable) movableOverdue.push(t);
    } else if (day === todayKey) {
      todayLoad += 1;
      if (movable) movableToday.push(t);
    }
  }

  return { todayKey, overdue, movableOverdue, todayLoad, movableToday };
}

/**
 * Önümüzdeki günlerin yükü: gün → görev sayısı.
 *
 * `leaving` içindeki görevler sayılmaz: yerlerinden kalkıyorlar, kendi eski yüklerini
 * hesaba katmak aynı görevi iki kez saymak olur.
 */
function futureLoads(
  tasks: BalancerTask[],
  todayKey: string,
  leaving: Set<number>,
  isPlanTask: (t: BalancerTask) => boolean,
): { day: string; load: number }[] {
  const byDay = new Map<string, { all: number; plan: number }>();
  // Plan motorunun her gün üreteceği tahmini iş: bugün ürettiği kadar (tamamlananlar
  // dahil — tamamlanmış olmaları yarın üretilmeyecekleri anlamına gelmez).
  let planPerDay = 0;

  for (const t of tasks) {
    if (!t || t.isArchived) continue;
    const day = calendarDayOf(t.dueDate);
    if (!day) continue;
    if (day === todayKey && (t.tags ?? []).includes('daily')) planPerDay += 1;
    if (t.isCompleted || leaving.has(t.id)) continue;
    const cur = byDay.get(day) ?? { all: 0, plan: 0 };
    cur.all += 1;
    if (isPlanTask(t)) cur.plan += 1;
    byDay.set(day, cur);
  }

  const out: { day: string; load: number }[] = [];
  for (let i = 1; i <= HORIZON_DAYS; i++) {
    const day = addDays(todayKey, i);
    const cur = byDay.get(day) ?? { all: 0, plan: 0 };
    // Günde ZATEN duran plan görevleri tahminden düşülür — çift sayılmasın.
    out.push({ day, load: cur.all + Math.max(0, planPerDay - cur.plan) });
  }
  return out;
}

/** Kapasitesi olan en boş gün; eşitlikte en yakını. Yer yoksa `null`. */
function pickDay(days: { day: string; load: number }[]): { day: string; load: number } | null {
  let best: { day: string; load: number } | null = null;
  for (const d of days) {
    if (d.load >= DAILY_CAPACITY) continue;
    if (!best || d.load < best.load) best = d; // dizi zaten tarih sıralı → eşitlikte ilk kalır
  }
  return best;
}

function byPriorityThenAge(a: BalancerTask, b: BalancerTask): number {
  const r = rankOf(a) - rankOf(b);
  if (r !== 0) return r;
  const da = calendarDayOf(a.dueDate) ?? '';
  const db = calendarDayOf(b.dueDate) ?? '';
  if (da !== db) return da < db ? -1 : 1;
  return a.id - b.id;
}

function distribute(
  candidates: BalancerTask[],
  tasks: BalancerTask[],
  todayKey: string,
  isPlanTask: (t: BalancerTask) => boolean,
  shouldShelve: (t: BalancerTask) => boolean,
): RebalancePlan {
  const ordered = [...candidates].sort(byPriorityThenAge);
  const days = futureLoads(tasks, todayKey, new Set(ordered.map((t) => t.id)), isPlanTask);
  const moves: Move[] = [];

  for (const task of ordered) {
    if (shouldShelve(task)) {
      moves.push({ task, to: null });
      continue;
    }
    const slot = pickDay(days);
    if (!slot) {
      moves.push({ task, to: null });
      continue;
    }
    slot.load += 1;
    moves.push({ task, to: slot.day });
  }

  const someday = moves.filter((m) => m.to === null).length;
  return { moves, scheduled: moves.length - someday, someday };
}

/** Birikmiş (gecikmiş) işi dengeler. */
export function planOverdue(tasks: BalancerTask[], opts: BalancerOptions = {}): RebalancePlan {
  const isPlanTask = opts.isPlanTask ?? defaultIsPlanTask;
  const { todayKey, movableOverdue } = analyzeLoad(tasks, { ...opts, isPlanTask });
  return distribute(movableOverdue, tasks, todayKey, isPlanTask, (t) => {
    if (rankOf(t) === 0) return false; // yüksek öncelik yaşından dolayı rafa kalkmaz
    const day = calendarDayOf(t.dueDate);
    return !!day && daysBetweenKeys(day, todayKey) > STALE_AFTER_DAYS;
  });
}

/**
 * Taşan bir günü hafifletir: kullanıcının BUGÜN yapacağı tek görev kalır, bugüne
 * yazılmış öteki taşınabilir görevler dağıtılır. Bunlar gecikmiş değil — yaş kuralı
 * uygulanmaz.
 */
export function planTriage(keepId: number, tasks: BalancerTask[], opts: BalancerOptions = {}): RebalancePlan {
  const isPlanTask = opts.isPlanTask ?? defaultIsPlanTask;
  const { todayKey, movableToday } = analyzeLoad(tasks, { ...opts, isPlanTask });
  const candidates = movableToday.filter((t) => t.id !== keepId);
  return distribute(candidates, tasks, todayKey, isPlanTask, () => false);
}

/** Bugün kapasiteyi aşıyor mu ve hafifletilecek (en az bir kalan + bir taşınan) iş var mı? */
export function isDayOverloaded(analysis: LoadAnalysis): boolean {
  return analysis.todayLoad > DAILY_CAPACITY && analysis.movableToday.length >= 2;
}
