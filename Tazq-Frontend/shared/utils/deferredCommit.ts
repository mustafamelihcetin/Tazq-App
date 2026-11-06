/*
  ERTELENMİŞ GÖNDERİM (2026-11-06). Geri alınabilir işlem, geri alma süresi bitene kadar sunucuya gitmez.

  Neden: sunucu tekrarlı görev tamamlanınca sonrakini hemen yaratıyor. Tasks.org bunu `undoRepeat` ile telafi eder;
  biz hiç göndermeyerek telafi gerektirmeyen yolu seçiyoruz. Actual'ın `undoable` fikrinin istemci karşılığı.
  Uygulama arka plana geçerse bekleyenler hemen gönderilir (sonner-native süreyi duraklatır; bizde işlem kaybolmamalı).
*/
export const UNDO_WINDOW_MS = 6000;

type Run = () => void | Promise<unknown>;
const pending = new Map<string, { run: Run; timer: ReturnType<typeof setTimeout> }>();

const execute = (key: string) => {
  const item = pending.get(key);
  if (!item) return;
  pending.delete(key);
  clearTimeout(item.timer);
  void item.run();
};

export function scheduleCommit(key: string, run: Run, ms: number = UNDO_WINDOW_MS): void {
  // Aynı anahtar yeniden geldiyse eskisi kaybolmaz, önce gönderilir.
  execute(key);
  const timer = setTimeout(() => execute(key), ms);
  (timer as unknown as { unref?: () => void })?.unref?.();
  pending.set(key, { run, timer });
}

/** Süresi dolmamış işlem var mı? Sunucudan gelen tazeleme bu kaydın yerel halini ezmesin diye. */
export const isCommitPending = (key: string): boolean => pending.has(key);

/** Henüz gönderilmediyse iptal eder ve true döner; süre geçmişse false. */
export function cancelCommit(key: string): boolean {
  const item = pending.get(key);
  if (!item) return false;
  clearTimeout(item.timer);
  pending.delete(key);
  return true;
}

/** Bekleyenleri hemen gönderir (arka plana geçiş). Kaç işlem gönderildiğini döner. */
export function flushCommits(): number {
  const keys = [...pending.keys()];
  keys.forEach(execute);
  return keys.length;
}

export const __resetCommitsForTests = () => {
  pending.forEach((p) => clearTimeout(p.timer));
  pending.clear();
};
