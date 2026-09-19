import {
  analyzeLoad, planOverdue, planTriage, isMovable, isDayOverloaded,
  DAILY_CAPACITY, STALE_AFTER_DAYS, type BalancerTask,
} from '@/features/tasks/utils/taskBalancer';
import { calendarDayOf, toDateKey } from '@/shared/utils/dateKey';

/**
 * TAZQZen MOTORU.
 *
 * ── NEDEN BU TEST VAR ─────────────────────────────────────────────────────────
 * Motorun önceki hâlinde iki ana kural da gerçek veride SESSİZCE çalışmıyordu ve bu
 * ancak ölçülerek görüldü:
 *
 *   · 10 gün gecikmiş görev rafa alınmak yerine YARINA konuyordu.
 *   · Yarında 8 görev varken taşınan iş yine yarına gidiyordu ("günde en fazla 5"
 *     hiç tutulmuyordu).
 *
 * İkisinin de sebebi aynıydı: motor tarihleri `'2026-09-19'` sanıyordu, sunucu ise
 * `'2026-09-19T00:00:00Z'` döndürüyor. Bu yüzden aşağıdaki verinin tamamı SUNUCU
 * BİÇİMİNDE kuruluyor — önceki testsiz hâl tam da gerçek veriyle hiç karşılaşmadığı
 * için "doğru" görünüyordu.
 */

const NOW = new Date(2026, 8, 19, 10, 0, 0); // 19 Eylül 2026 Cumartesi, 10:00
const day = (offset: number) => { const d = new Date(NOW); d.setDate(d.getDate() + offset); return toDateKey(d); };
/** Sunucunun saf-gün biçimi. */
const srv = (offset: number) => `${day(offset)}T00:00:00Z`;

let seq = 0;
const task = (dueDate: string | null, extra: Partial<BalancerTask> = {}): BalancerTask => ({
  id: ++seq, title: `g${seq}`, isCompleted: false, isArchived: false, priority: 'Medium', dueDate, tags: [], ...extra,
});
const opts = { now: NOW };
const target = (plan: ReturnType<typeof planOverdue>, t: BalancerTask) => plan.moves.find((m) => m.task.id === t.id)?.to;

beforeEach(() => { seq = 0; });

describe('takvim günü okuyucusu', () => {
  it('üç biçimi de doğru güne indiriyor', () => {
    expect(calendarDayOf('2026-09-19')).toBe('2026-09-19');
    // Sunucunun saf gün biçimi → gün kısmı (UTC'ye çevirmek negatif ofsette kaydırırdı)
    expect(calendarDayOf('2026-09-19T00:00:00Z')).toBe('2026-09-19');
    expect(calendarDayOf('2026-09-19T00:00:00')).toBe('2026-09-19');
    expect(calendarDayOf('2026-09-19T00:00:00.000Z')).toBe('2026-09-19');
  });

  it('gerçek bir AN yerel güne çevriliyor', () => {
    const local = new Date(2026, 8, 19, 14, 30);
    expect(calendarDayOf(local.toISOString())).toBe('2026-09-19');
  });

  it('sunucunun "tarih yok" değeri ve bozuk veri → null', () => {
    // '0001-01-01' gerçek bir tarih sayılsaydı görev "2000 yıl gecikmiş" olurdu.
    expect(calendarDayOf('0001-01-01T00:00:00Z')).toBeNull();
    expect(calendarDayOf(null)).toBeNull();
    expect(calendarDayOf('')).toBeNull();
    expect(calendarDayOf('bozuk')).toBeNull();
  });
});

describe('kim taşınabilir', () => {
  it('plan görevleri TAŞINMAZ', () => {
    /*
      Plan motoru "bugün üretildi mi" sorusunu görevin TARİHİNE bakarak cevaplıyor.
      Bugünün plan görevi yarına gidince motor bugünü boş sanıp aynı görevleri yeniden
      üretiyordu — çift görev. Uygulama plan görevlerinin arşivlenmesini de bu yüzden
      yasaklıyor.
    */
    expect(isMovable(task(srv(-1), { tags: ['daily', 'exam'] }), opts)).toBe(false);
    expect(isMovable(task(srv(-1), { tags: ['spor'] }), opts)).toBe(false);
    expect(isMovable(task(srv(-1), { tags: ['weight_entry'] }), opts)).toBe(false);
    expect(isMovable(task(srv(-1), { tags: ['work'] }), opts)).toBe(true);
  });

  it('SAATLİ görev taşınmaz — saat bir taahhüttür (randevu, toplantı)', () => {
    // Triage bugün 15:00'teki doktor randevusunu yarına atabiliyordu.
    expect(isMovable(task(srv(0), { dueTime: '2026-09-19T12:00:00.000Z' }), opts)).toBe(false);
    expect(isMovable(task(srv(-2), { dueTime: '2026-09-17T07:00:00.000Z' }), opts)).toBe(false);
    // Sunucunun "saat yok" değeri saat sayılmaz
    expect(isMovable(task(srv(-2), { dueTime: '0001-01-01T00:00:00Z' }), opts)).toBe(true);
  });

  it('TEKRARLAYAN görev taşınmaz — seri kaymasın', () => {
    // Sunucu sonraki örneği görevin TARİHİNDEN hesaplıyor (DueDate + aralık): pazartesi
    // görevi perşembeye taşınınca seri kalıcı olarak perşembeye kayardı.
    expect(isMovable(task(srv(-2), { recurrence: 'Weekly' }), opts)).toBe(false);
    expect(isMovable(task(srv(-2), { recurrence: 'Daily' }), opts)).toBe(false);
    expect(isMovable(task(srv(-2), { recurrence: 'None' }), opts)).toBe(true);
  });

  it('sabit görevler yükte SAYILIR — kapasite dürüst kalsın', () => {
    const fixed = Array.from({ length: 5 }, () => task(srv(1), { dueTime: '2026-09-20T07:00:00.000Z' }));
    const mover = task(srv(-1));
    expect(target(planOverdue([...fixed, mover], opts), mover)).toBe(day(2));
  });

  it('triage bugünün saatli ve tekrarlayan işlerini listeye koymaz, taşımaz', () => {
    const keep = task(srv(0));
    const meeting = task(srv(0), { dueTime: '2026-09-19T12:00:00.000Z' });
    const weekly = task(srv(0), { recurrence: 'Weekly' });
    const free = task(srv(0));
    const a = analyzeLoad([keep, meeting, weekly, free], opts);
    expect(a.movableToday.map((t) => t.id)).toEqual([keep.id, free.id]);
    expect(a.todayLoad).toBe(4);
    const moved = planTriage([keep.id], [keep, meeting, weekly, free], opts).moves.map((m) => m.task.id);
    expect(moved).toEqual([free.id]);
  });

  it('dışarıdan verilen plan tanıyıcısına uyuyor', () => {
    // Ekran, mod bilgisini (getModeInfoForTask) buradan ekliyor.
    const t = task(srv(-1), { title: 'Güncel kilonu gir' });
    expect(isMovable(t, { ...opts, isPlanTask: (x) => x.title === 'Güncel kilonu gir' })).toBe(false);
  });

  it('tamamlanan, arşivlenen, tarihsiz ve "tarih yok" görevler dışarıda', () => {
    expect(isMovable(task(srv(-1), { isCompleted: true }), opts)).toBe(false);
    expect(isMovable(task(srv(-1), { isArchived: true }), opts)).toBe(false);
    expect(isMovable(task(null), opts)).toBe(false);
    expect(isMovable(task('0001-01-01T00:00:00Z'), opts)).toBe(false);
  });
});

describe('yük analizi', () => {
  it('gecikmiş: SUNUCU biçimindeki dünün görevi gecikmiş, bugününki değil', () => {
    const a = analyzeLoad([task(srv(-1)), task(srv(0))], opts);
    expect(a.overdue).toHaveLength(1);
    expect(a.todayLoad).toBe(1);
  });

  it('plan görevleri sayılıyor ama taşınabilir sayılmıyor — sayı dürüst kalsın', () => {
    const a = analyzeLoad([task(srv(-2), { tags: ['daily', 'tez'] }), task(srv(-2))], opts);
    expect(a.overdue).toHaveLength(2);
    expect(a.movableOverdue).toHaveLength(1);
  });

  it('taşan gün: kapasite aşılıyor VE en az iki taşınabilir iş var', () => {
    const full = Array.from({ length: DAILY_CAPACITY + 1 }, () => task(srv(0)));
    expect(isDayOverloaded(analyzeLoad(full, opts))).toBe(true);
    // Hepsi plan görevi → hafifletilecek bir şey yok, triage açılmamalı.
    const planOnly = Array.from({ length: DAILY_CAPACITY + 1 }, () => task(srv(0), { tags: ['daily', 'exam'] }));
    expect(isDayOverloaded(analyzeLoad(planOnly, opts))).toBe(false);
    // Kapasitede ama aşmıyor → taşma yok.
    const atCap = Array.from({ length: DAILY_CAPACITY }, () => task(srv(0)));
    expect(isDayOverloaded(analyzeLoad(atCap, opts))).toBe(false);
  });
});

describe('Belki Bir Gün kuralı', () => {
  it(`${STALE_AFTER_DAYS} günden eski iş rafa alınıyor — SUNUCU biçiminde de`, () => {
    // Kusurun ta kendisi: bu görev eskiden yarına konuyordu.
    const old = task(srv(-10));
    const plan = planOverdue([old], opts);
    expect(target(plan, old)).toBeNull();
    expect(plan.someday).toBe(1);
  });

  it('sınırdaki iş (tam 3 gün) rafa alınmıyor, dağıtılıyor', () => {
    const edge = task(srv(-STALE_AFTER_DAYS));
    expect(target(planOverdue([edge], opts), edge)).toBe(day(1));
  });

  it('YÜKSEK öncelik yaşından dolayı rafa kalkmıyor', () => {
    const important = task(srv(-30), { priority: 'High' });
    expect(target(planOverdue([important], opts), important)).toBe(day(1));
  });
});

describe('kapasite ve dağıtım', () => {
  it('gerçek yükü görüyor: dolu günü atlıyor', () => {
    // Kusurun ta kendisi: yarında 8 görev varken iş yine yarına gidiyordu.
    const busy = Array.from({ length: 8 }, () => task(srv(1)));
    const mover = task(srv(-1));
    const to = target(planOverdue([...busy, mover], opts), mover);
    expect(to).not.toBe(day(1));
    expect(to).toBe(day(2));
  });

  it('hiçbir gün kapasiteyi aşmıyor', () => {
    const movers = Array.from({ length: 30 }, () => task(srv(-1)));
    const plan = planOverdue(movers, opts);
    const perDay = new Map<string, number>();
    for (const m of plan.moves) if (m.to) perDay.set(m.to, (perDay.get(m.to) ?? 0) + 1);
    for (const n of perDay.values()) expect(n).toBeLessThanOrEqual(DAILY_CAPACITY);
    // 7 gün × 5 = 35 yer; 30 görev sığar.
    expect(plan.someday).toBe(0);
  });

  it('sığmayan iş rafa gidiyor — taşırmak yerine', () => {
    const movers = Array.from({ length: 40 }, () => task(srv(-1)));
    const plan = planOverdue(movers, opts);
    expect(plan.scheduled).toBe(35);
    expect(plan.someday).toBe(5);
  });

  it('plan motorunun GELECEKTE üreteceği işi de hesaba katıyor', () => {
    /*
      Motor görevleri gününde üretiyor, önceden değil. Bugün 4 plan görevi varsa,
      yarın da ~4 tane gelecek. Sayılmasaydı gelecek günler boş görünür ve iş
      yerleştirildikten sonra kapasite yine taşardı.
    */
    const todayPlan = Array.from({ length: 4 }, () => task(srv(0), { tags: ['daily', 'exam'], isCompleted: true }));
    const movers = Array.from({ length: 7 }, () => task(srv(-1)));
    const plan = planOverdue([...todayPlan, ...movers], opts);
    const perDay = new Map<string, number>();
    for (const m of plan.moves) if (m.to) perDay.set(m.to, (perDay.get(m.to) ?? 0) + 1);
    // 4 plan + en fazla 1 taşınan = 5
    for (const n of perDay.values()) expect(n).toBeLessThanOrEqual(DAILY_CAPACITY - 4);
  });

  it('önce yüksek öncelik yerleşiyor — en yakın boş günü o alıyor', () => {
    const low = task(srv(-1), { priority: 'Low' });
    const high = task(srv(-1), { priority: 'High' });
    const plan = planOverdue([low, high], opts);
    expect(plan.moves[0].task.id).toBe(high.id);
    expect(target(plan, high)).toBe(day(1));
  });

  it('eşit yükte en YAKIN gün seçiliyor ve sonuç her çalıştırmada aynı', () => {
    const movers = [task(srv(-1)), task(srv(-2)), task(srv(-1))];
    const a = planOverdue(movers, opts).moves.map((m) => m.to);
    const b = planOverdue(movers, opts).moves.map((m) => m.to);
    expect(a).toEqual(b);
    expect(a[0]).toBe(day(1));
  });

  it('plan görevleri planda HİÇ yer almıyor', () => {
    const plan = planOverdue([task(srv(-5), { tags: ['daily', 'spor'] })], opts);
    expect(plan.moves).toHaveLength(0);
  });
});

describe('taşan gün (triage)', () => {
  it('seçilen görev kalıyor, bugünün öteki taşınabilir işleri dağıtılıyor', () => {
    const keep = task(srv(0));
    const others = Array.from({ length: 5 }, () => task(srv(0)));
    const plan = planTriage([keep.id], [keep, ...others], opts);
    expect(plan.moves.map((m) => m.task.id)).not.toContain(keep.id);
    expect(plan.moves).toHaveLength(5);
    expect(plan.moves.every((m) => m.to !== null && m.to > day(0))).toBe(true);
  });

  it('bugünün PLAN görevleri yerinde kalıyor', () => {
    const keep = task(srv(0));
    const planToday = task(srv(0), { tags: ['daily', 'exam'] });
    const plan = planTriage([keep.id], [keep, planToday, task(srv(0))], opts);
    expect(plan.moves.map((m) => m.task.id)).not.toContain(planToday.id);
  });

  it('birden fazla görev tutulabiliyor — seçilenlerin HİÇBİRİ taşınmıyor', () => {
    const a = task(srv(0)); const b = task(srv(0)); const c = task(srv(0));
    const rest = Array.from({ length: 3 }, () => task(srv(0)));
    const moved = planTriage([a.id, b.id, c.id], [a, b, c, ...rest], opts).moves.map((m) => m.task.id);
    expect(moved.sort()).toEqual(rest.map((t) => t.id).sort());
  });

  it('gecikmiş değil — yaş kuralı uygulanmıyor', () => {
    const keep = task(srv(0));
    const low = task(srv(0), { priority: 'Low' });
    expect(planTriage([keep.id], [keep, low], opts).someday).toBe(0);
  });
});
