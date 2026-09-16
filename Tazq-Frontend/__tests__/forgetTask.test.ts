import { planIdsWithout, readPlanSlots, PLAN_SLOTS } from '@/features/tasks/utils/forgetTask';

/**
 * SİLİNEN GÖREV HER YERDEN SİLİNİR.
 *
 * ── NEDEN BU TEST VAR ─────────────────────────────────────────────────────────
 * Görev silmenin ÜÇ yolu vardı ve üçü farklı şeyler temizliyordu:
 *
 *   · Tek silme                → bildirim · takvim · plan dizileri
 *   · Toplu silme              → hiçbiri
 *   · "Tamamlananları temizle" → hiçbiri
 *
 * En görünür sonucu: beş görevi toplu silen kullanıcı, o beş görevin HATIRLATICILARINI
 * almaya devam ediyordu. Silinmiş bir işin bildirimi, uygulamanın verebileceği en
 * güvensiz sinyaldir.
 *
 * Gözden kaçtığının kanıtı: toplu ARŞİVLEME bildirimleri iptal ediyordu. Arşivlemek
 * silmekten zararsızdır; daha zararlısının daha az temizlik yapması bir karar olamaz.
 *
 * Üstelik tek silmedeki liste bile EKSİKTİ: on bir yuva yazılıydı, mağazada on üç var.
 */

type Slots = Record<(typeof PLAN_SLOTS)[number], { habitIds: string[]; taskIds: number[] }>;

const emptySlots = (): Slots => {
  const out = {} as Slots;
  for (const slot of PLAN_SLOTS) out[slot] = { habitIds: [], taskIds: [] };
  return out;
};

describe('plan yuvaları', () => {
  it('mağazadaki TÜM modları kapsıyor — elle tutulan liste eskimesin', () => {
    /*
      `handleDelete` içinde on bir yuvalık bir liste elle yazılıydı ve `tasarruf` ile
      `birakma` unutulmuştu: o planlara ait bir görev silindiğinde kimliği plan
      dizisinde kalmaya devam ediyordu. Liste artık mağazanın kendi tipinden türüyor
      (`satisfies readonly PlanMode[]`), yani yeni bir mod eklenip buraya eklenmezse
      DERLEME kırılır. Bu test o kapsamı ayrıca okunur kılıyor.
    */
    expect([...PLAN_SLOTS].sort()).toEqual(
      ['birakma', 'exam', 'exam2', 'exam3', 'mulakat', 'mulakat2', 'mulakat3',
       'ramazan', 'spor', 'spor2', 'spor3', 'tasarruf', 'tez'].sort(),
    );
    expect(PLAN_SLOTS).toContain('tasarruf');
    expect(PLAN_SLOTS).toContain('birakma');
  });

  it('mağaza alan adlarını doğru okuyor', () => {
    const prefs = {
      setPlanIds: jest.fn(),
      examPlanTaskIds: [1, 2],
      examPlanHabitIds: ['h1'],
      birakmaPlanTaskIds: [9],
    } as any;
    const slots = readPlanSlots(prefs);
    expect(slots.exam).toEqual({ habitIds: ['h1'], taskIds: [1, 2] });
    expect(slots.birakma).toEqual({ habitIds: [], taskIds: [9] });
    // Hiç yazılmamış yuva boş dizi döner — `undefined` aşağı sızmaz.
    expect(slots.tez).toEqual({ habitIds: [], taskIds: [] });
  });
});

describe('plan dizilerinden düşürme', () => {
  it('silinen kimlik her yuvadan çıkıyor', () => {
    const slots = emptySlots();
    slots.exam = { habitIds: ['h1'], taskIds: [1, 2, 3] };
    slots.tasarruf = { habitIds: [], taskIds: [3, 4] };

    const out = planIdsWithout(slots, new Set([3]));
    expect(out).toHaveLength(2);
    expect(out.find((o) => o.slot === 'exam')!.taskIds).toEqual([1, 2]);
    expect(out.find((o) => o.slot === 'tasarruf')!.taskIds).toEqual([4]);
  });

  it('alışkanlık kimliklerine DOKUNMUYOR', () => {
    // Görev siliniyor; alışkanlıklar başka bir varlık. Yuvayı yeniden yazarken
    // onları da taşımak zorundayız, yoksa görev silmek alışkanlığı da düşürür.
    const slots = emptySlots();
    slots.spor = { habitIds: ['h1', 'h2'], taskIds: [5] };
    const out = planIdsWithout(slots, new Set([5]));
    expect(out[0].habitIds).toEqual(['h1', 'h2']);
  });

  it('DEĞİŞMEYEN yuva geri dönmüyor — gereksiz yazma yok', () => {
    /*
      Her yuvayı koşulsuz yeniden yazmak tercih mağazasını kirletir ve bulut
      eşitlemesini boşuna tetikler. Yalnız gerçekten değişen yuva döner.
    */
    const slots = emptySlots();
    slots.exam = { habitIds: [], taskIds: [1, 2] };
    slots.tez = { habitIds: [], taskIds: [7] };
    expect(planIdsWithout(slots, new Set([99]))).toEqual([]);
    expect(planIdsWithout(slots, new Set([7])).map((o) => o.slot)).toEqual(['tez']);
  });

  it('birden çok kimlik tek geçişte düşüyor', () => {
    const slots = emptySlots();
    slots.ramazan = { habitIds: [], taskIds: [1, 2, 3, 4] };
    expect(planIdsWithout(slots, new Set([2, 4])).at(0)!.taskIds).toEqual([1, 3]);
  });

  it('boş ve eksik yuvalarda çökmüyor', () => {
    const slots = emptySlots();
    // @ts-expect-error — bilinçli olarak bozuk veri veriliyor (diskten gelen eski kayıt)
    slots.exam = { habitIds: undefined, taskIds: undefined };
    expect(() => planIdsWithout(slots, new Set([1]))).not.toThrow();
    expect(planIdsWithout(slots, new Set([1]))).toEqual([]);
  });
});
