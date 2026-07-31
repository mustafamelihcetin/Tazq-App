import { matchesTaskFilter, type TaskFilter } from '@/features/tasks/utils/taskFilter';

/**
 * GÖREV FİLTRESİ — listeyi neyin oluşturduğunu tanımlayan tek yüklem.
 *
 * ── NEDEN AYRI BİR DOSYA ────────────────────────────────────────────────────────
 * Görevler ekranının başında iki büyük sayı kartı vardı ve altlarında aynı işi yapan
 * çip şeritleri. Sayılar bir yerde, filtreleme başka bir yerde hesaplanıyordu — ve
 * birbirini tutmuyorlardı: "Bekleyen" kartı TAMAMLANMAMIŞ görevleri sayıyor ama basınca
 * `filter='all'` yapıyordu, yani "12 bekleyen" yazan karta basınca tamamlananlar dahil
 * bütün liste açılıyordu. Aynı sorunun cevabı iki yerde yazılmıştı.
 *
 * Kartlar ve şeritler sonra tümden kaldırıldı (ekranın odağı görev listesi olmalıydı),
 * ama yüklemin tek yerde durması kaldı: liste bu fonksiyondan geçiyor ve filtre
 * davranışı buradan okunuyor.
 */

const NOW = new Date('2026-07-31T12:00:00');
const at = (iso: string) => iso;

const task = (p: Partial<{ isCompleted: boolean; priority: string; dueDate: string | null }> = {}) => ({
  isCompleted: false,
  priority: 'Medium',
  dueDate: at('2026-07-31T09:00:00'),
  ...p,
});

describe('matchesTaskFilter', () => {
  it('"all" her şeyi geçirir — tamamlananlar dahil', () => {
    expect(matchesTaskFilter(task(), 'all', NOW)).toBe(true);
    expect(matchesTaskFilter(task({ isCompleted: true }), 'all', NOW)).toBe(true);
  });

  it('"done" yalnız tamamlananları geçirir', () => {
    expect(matchesTaskFilter(task({ isCompleted: true }), 'done', NOW)).toBe(true);
    expect(matchesTaskFilter(task({ isCompleted: false }), 'done', NOW)).toBe(false);
  });

  describe('"today"', () => {
    it('bugüne ait ve açık görevi geçirir', () => {
      expect(matchesTaskFilter(task({ dueDate: at('2026-07-31T23:30:00') }), 'today', NOW)).toBe(true);
      expect(matchesTaskFilter(task({ dueDate: at('2026-07-31T00:01:00') }), 'today', NOW)).toBe(true);
    });

    it('tamamlanmış görevi geçirmez — "bugün" bir yapılacaklar görünümü', () => {
      expect(matchesTaskFilter(task({ isCompleted: true }), 'today', NOW)).toBe(false);
    });

    it('başka güne aitse geçmez', () => {
      expect(matchesTaskFilter(task({ dueDate: at('2026-08-01T09:00:00') }), 'today', NOW)).toBe(false);
      expect(matchesTaskFilter(task({ dueDate: at('2026-07-30T23:59:00') }), 'today', NOW)).toBe(false);
    });

    it('tarihsiz görev geçmez', () => {
      expect(matchesTaskFilter(task({ dueDate: null }), 'today', NOW)).toBe(false);
    });

    it('sunucunun "tarih yok" değeri (0001-01-01) gerçek tarih sayılmaz', () => {
      expect(matchesTaskFilter(task({ dueDate: '0001-01-01T00:00:00Z' }), 'today', NOW)).toBe(false);
    });

    it('bozuk tarih çökmeden elenir', () => {
      expect(matchesTaskFilter(task({ dueDate: 'bozuk' }), 'today', NOW)).toBe(false);
    });
  });

  describe('öncelik filtreleri', () => {
    it('yalnız o önceliği geçirir', () => {
      expect(matchesTaskFilter(task({ priority: 'High' }), 'High', NOW)).toBe(true);
      expect(matchesTaskFilter(task({ priority: 'Low' }), 'High', NOW)).toBe(false);
    });

    it('tamamlanmışları geçirmez — arşiv değil, yapılacaklar görünümü', () => {
      expect(matchesTaskFilter(task({ priority: 'High', isCompleted: true }), 'High', NOW)).toBe(false);
    });
  });
});

/**
 * FİLTRELER BİRBİRİNİ KAPSAMAZ — menü kısaltılırken dayanılan varsayım.
 *
 * Görevler ekranında altı filtre satırı vardı ve beşi menüde ZATEN VAR OLAN yeteneklerin
 * kopyasıydı: öncelik filtreleri "Öncelik" sıralamasının, "Tamamlanan" ise
 * "Tamamlananları Gizle" anahtarının tekrarı. Geriye tek gerçek yetenek kaldı: bugüne
 * daralmak.
 *
 * Bu testler o sadeleştirmenin dayandığı davranışı sabitliyor — "bugün" başka hiçbir
 * filtreyle karıştırılamaz ve öncelik filtreleri birbirinden ayrıktır.
 */
describe('filtreler ayrık ve öngörülebilir', () => {
  const tasks = [
    task({ priority: 'High' }),
    task({ priority: 'High', isCompleted: true }),
    task({ priority: 'Low', dueDate: at('2026-08-05T09:00:00') }),
    task({ priority: 'Medium', isCompleted: true }),
    task({ priority: 'Medium', dueDate: null }),
  ];

  const listed = (f: TaskFilter) => tasks.filter((t) => matchesTaskFilter(t, f, NOW));

  it('"all" diğer tüm filtrelerin sonuçlarını kapsar', () => {
    const all = listed('all');
    for (const f of ['today', 'High', 'Medium', 'Low', 'done'] as TaskFilter[]) {
      for (const t of listed(f)) expect(all).toContain(t);
    }
  });

  it('öncelik filtreleri ÖRTÜŞMEZ — bir görev tek bir öncelik kovasına düşer', () => {
    const high = listed('High');
    const med = listed('Medium');
    const low = listed('Low');
    for (const t of high) { expect(med).not.toContain(t); expect(low).not.toContain(t); }
    for (const t of med) expect(low).not.toContain(t);
  });

  it('"done" ile öncelik filtreleri hiç kesişmez', () => {
    // Öncelik görünümleri yapılacaklar listesidir; bitmiş iş oraya düşmez.
    const done = listed('done');
    for (const f of ['High', 'Medium', 'Low', 'today'] as TaskFilter[]) {
      for (const t of listed(f)) expect(done).not.toContain(t);
    }
  });

  it('"today" yalnız açık ve bugüne ait görevleri verir', () => {
    for (const t of listed('today')) {
      expect(t.isCompleted).toBe(false);
      expect(t.dueDate).toBeTruthy();
    }
  });
});
