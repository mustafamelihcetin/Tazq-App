export type TaskFilter = 'all' | 'today' | 'High' | 'Medium' | 'Low' | 'done';

interface FilterableTask {
  isCompleted: boolean;
  priority: string;
  dueDate?: string | null;
}

/**
 * GÖREV FİLTRESİ — listeyi çizen ve sayıyı yazan TEK kaynak.
 *
 * ── NEDEN AYRI BİR FONKSİYON ────────────────────────────────────────────────────
 * Görevler ekranının başında iki büyük sayı kartı vardı ("Tamamlanan N", "Bekleyen N")
 * ve altlarında aynı işi yapan filtre çipleri. Sayılar bir yerde, filtreleme başka bir
 * yerde hesaplanıyordu — ve ikisi birbirini tutmuyordu:
 *
 *   "Bekleyen" kartı TAMAMLANMAMIŞ görevleri sayıyordu ama basınca `filter='all'`
 *   yapıyordu; yani "12 bekleyen" yazan karta basınca tamamlananlar dahil 30 görev
 *   listeleniyordu. Sayı ile liste aynı ekranda birbirini yalanlıyordu.
 *
 * Sayı ve liste artık aynı yüklemden geçiyor: birinin doğru öteki yanlış olması
 * imkânsız. Sessiz tutarsızlıkların çoğu tam olarak böyle doğar — aynı sorunun cevabı
 * iki ayrı yerde yazılır, biri güncellenir, öteki unutulur.
 */
export function matchesTaskFilter(
  task: FilterableTask,
  filter: TaskFilter,
  now: Date = new Date(),
): boolean {
  if (filter === 'all') return true;

  if (filter === 'done') return task.isCompleted;

  if (filter === 'today') {
    if (task.isCompleted) return false;
    // '0001-01-01' sunucunun "tarih yok" değeri — gerçek bir tarih değil.
    if (!task.dueDate || task.dueDate.startsWith('0001')) return false;
    const d = new Date(task.dueDate);
    if (Number.isNaN(d.getTime())) return false;
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }

  // Öncelik filtreleri TAMAMLANMAMIŞ görevleri gösterir: "Yüksek" bir yapılacaklar
  // görünümüdür, bitmiş işlerin arşivi değil.
  return task.priority === filter && !task.isCompleted;
}
