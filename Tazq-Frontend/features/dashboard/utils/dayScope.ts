import { isSomeday } from '@/features/tasks/utils/taskTags';
import { todayKey, wasCompletedOn } from '@/features/dashboard/utils/streakDay';

/**
 * "BUGÜNÜN İŞİ" — TEK TANIM.
 *
 * Ana ekran ile Günüm aynı günü farklı sayıyordu: ana ekran "1/5", Günüm "1/4".
 * Ana ekran gecikmişleri de sayıyordu, Günüm yalnız vadesi tam bugün olanları — yani
 * dünden kalan iş Günüm'de hiç görünmüyor, kapatılamıyordu. Kural artık burada ve iki
 * ekran da buradan okuyor.
 *
 *  - incomplete: vadesi BUGÜNE KADAR gelmiş, bitmemiş (gecikmişler dahil)
 *  - undated:    tarihsiz, bitmemiş — "Belki Bir Gün" HARİÇ (Zen onu bilerek günün dışına alır)
 *  - completed:  BUGÜN bitirilen her şey (vadesi ne olursa olsun) + vadesi bugün olup bitmiş
 *
 * Tarihsizler günün HEDEFİNE girmez: tarih taahhüdü taşımıyorlar; girseydi kalıcı bir
 * "mutfak düzeni" görevi olan kullanıcının günü asla kapanmazdı.
 */
export interface DayScope<T> {
  incomplete: T[];
  undated: T[];
  completed: T[];
}

interface ScopableTask {
  dueDate?: string | null;
  isCompleted?: boolean;
  completedAt?: string | null;
  tags?: string[];
}

/**
 * OKUNAMAYAN TARİH = TARİHSİZ. `new Date('bozuk')` NaN döner ve NaN'la her karşılaştırma
 * yanlıştır: böyle bir görev hiçbir listeye girmeyip ekrandan kayboluyordu.
 * '0001-01-01' sunucunun "tarih yok" değeri — yıl 1 sayılsaydı görev gecikmiş olurdu.
 */
export function dueAt(t: ScopableTask | null | undefined): number | null {
  if (!t?.dueDate || String(t.dueDate).startsWith('0001')) return null;
  const ms = new Date(t.dueDate).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function scopeDay<T extends ScopableTask>(tasks: T[], now: Date = new Date()): DayScope<T> {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const endMs = startMs + 86400000;
  const today = todayKey(now);

  const incomplete = tasks.filter(t => {
    if (!t || t.isCompleted) return false;
    const ms = dueAt(t);
    return ms !== null && ms <= endMs;
  });
  const undated = tasks.filter(t => t && !t.isCompleted && dueAt(t) === null && !isSomeday(t));
  /*
    `completedAt` dalı: gecikmiş ya da tarihsiz bir görev bugün bitirilince ikisinin de
    dışında kalıp ana sayfadan yok oluyordu. Vade dalı yedek: sunucu `completedAt` tutmuyor.
  */
  const completed = tasks.filter(t => {
    if (!t?.isCompleted) return false;
    if (wasCompletedOn(t, today)) return true;
    const ms = dueAt(t);
    return ms !== null && ms >= startMs && ms <= endMs;
  });
  return { incomplete, undated, completed };
}

/**
 * Bugün DIŞINDAKİ bir günün kapsamı (Takvim: geçmiş = kayıt, gelecek = plan).
 *
 * `scopeDay`'den farkı bilinçli: orada önceki günlerden taşan gecikmiş işler bugüne
 * dahildir (günü kapatmanın konusu onlar). Başka bir günde bu kural yanlış olurdu —
 * 27 Ekim'e bakan kullanıcı 20 Ekim'den kalan işi "o günün işi" diye görmemeli.
 */
export function scopeOtherDay<T extends ScopableTask>(tasks: T[], day: Date): Omit<DayScope<T>, 'undated'> {
  const start = new Date(day); start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const endMs = startMs + 86400000;
  // Öğlenden: gün anahtarı gece yarısını bir önceki güne sayıyor (seri günü kuralı).
  const key = todayKey(new Date(startMs + 12 * 3600000));
  const inDay = (t: T) => { const ms = dueAt(t); return ms !== null && ms >= startMs && ms < endMs; };
  return {
    incomplete: tasks.filter(t => t && !t.isCompleted && inDay(t)),
    completed: tasks.filter(t => t?.isCompleted && (wasCompletedOn(t, key) || inDay(t))),
  };
}

/** Vadesi bugünden ÖNCE olan bitmemiş görev mi (Günüm'de "Süresi geçti"). */
export function isOverdueBefore(t: ScopableTask, now: Date = new Date()): boolean {
  const ms = dueAt(t);
  if (ms === null || t.isCompleted) return false;
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  return ms < start.getTime();
}
