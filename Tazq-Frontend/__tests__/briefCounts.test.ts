import fs from 'fs';
import path from 'path';
import { openThrough, completedOn, nextAt, reminderTasks, notificationSignature } from '@/features/tasks/utils/briefCounts';

/**
 * ÖZET BİLDİRİMLERİ — sayılar gerçeği söylemeli.
 *
 * Kullanıcı sabah "Bugün 16 görevin var" aldı; o an bugüne kadar vadesi gelmiş açık işi
 * 4 taneydi. Sabah özeti her gün tekrar eden, sayısı donmuş bir bildirimdi; akşamın
 * "yarın için hazır" sayısı aylar sonrasını ve rafı da sayıyordu.
 * Sabit an: 19 Eylül 2026 Cumartesi, 10:00.
 */
const NOW = new Date(2026, 8, 19, 10, 0, 0);
let seq = 0;
const t = (dueDate: string | null, extra: Record<string, unknown> = {}) =>
  ({ id: ++seq, title: `g${seq}`, isCompleted: false, dueDate, tags: [] as string[], ...extra });

describe('açık iş sayımı — ana ekranla aynı tanım', () => {
  it('bugün + gecikmiş sayılır; uzak gelecek, raf, arşiv ve tamamlanan SAYILMAZ', () => {
    const tasks = [
      t('2026-09-19T00:00:00Z'),                      // bugün ✓
      t('2026-09-10T00:00:00Z'),                      // gecikmiş ✓
      t('2026-12-01T00:00:00Z'),                      // aylar sonra ✗
      t(null, { tags: ['someday'] }),                 // raf ✗
      t('2026-09-18T00:00:00Z', { isArchived: true }),// arşiv ✗
      t('2026-09-19T00:00:00Z', { isCompleted: true }), // bitmiş ✗
      t(null),                                        // tarihsiz ✗
    ];
    expect(openThrough(tasks, '2026-09-19')).toBe(2);
  });

  it('yarının sabahı için YARININ işleri de sayılır', () => {
    const tasks = [t('2026-09-19T00:00:00Z'), t('2026-09-20T00:00:00Z'), t('2026-09-21T00:00:00Z')];
    expect(openThrough(tasks, '2026-09-20')).toBe(2);
  });

  it('bugün tamamlananlar (completedAt, yoksa vade günü)', () => {
    const tasks = [
      t('2026-09-10T00:00:00Z', { isCompleted: true, completedAt: new Date(2026, 8, 19, 9).toISOString() }),
      t('2026-09-19T00:00:00Z', { isCompleted: true }),
      t('2026-09-18T00:00:00Z', { isCompleted: true }),
    ];
    expect(completedOn(tasks, '2026-09-19')).toBe(2);
  });
});

describe('bildirimin çalacağı an', () => {
  it('saat geçmediyse bugün, geçtiyse yarın', () => {
    expect(nextAt(NOW, 21).getDate()).toBe(19);
    expect(nextAt(NOW, 7).getDate()).toBe(20);
  });
});

describe('hatırlatıcılar görevlerle yaşar', () => {
  it('yalnız hatırlatıcı istenmiş, açık, tarihli görevler — en yakından', () => {
    const tasks = [
      t('2026-10-27T00:00:00Z', { tags: ['hatırlatıcı'] }),
      t('2026-09-27T00:00:00Z', { tags: ['reminder'] }),
      t('2026-09-20T00:00:00Z'),                                        // istenmemiş ✗
      t('2026-09-21T00:00:00Z', { tags: ['hatırlatıcı'], isCompleted: true }), // bitmiş ✗
    ];
    expect(reminderTasks(tasks).map((x) => x.dueDate)).toEqual(['2026-09-27T00:00:00Z', '2026-10-27T00:00:00Z']);
  });

  it('iz yalnız SAYILAR ya da hatırlatıcılar değişince değişir', () => {
    const base = [t('2026-09-19T00:00:00Z'), t('2026-09-30T00:00:00Z')];
    const a = notificationSignature(base, NOW);
    // Uzak bir görevin başlığı değişti: sayılar aynı → yeniden kurma yok
    const b = notificationSignature([base[0], { ...base[1], title: 'yeni ad' }], NOW);
    expect(b).toBe(a);
    // Bugünün işi tamamlandı → iz değişir → özet yeniden kurulur
    const c = notificationSignature([{ ...base[0], isCompleted: true }, base[1]], NOW);
    expect(c).not.toBe(a);
  });
});

describe('bildirim modülü', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'shared/utils/notifications.ts'), 'utf8');
  const layout = fs.readFileSync(path.join(__dirname, '..', 'app/_layout.tsx'), 'utf8');

  it('sabah özeti HER GÜN TEKRAR EDEN değil — tek seferlik', () => {
    const fn = src.slice(src.indexOf('export async function scheduleMorningBrief'), src.indexOf('export async function cancelMorningBrief'));
    expect(fn).not.toContain("type: 'daily'");
    expect(fn).toContain("type: 'date'");
  });

  it('akşam özeti önce iptal eder — söylenecek şey kalmadıysa eski bildirim çalmaz', () => {
    const fn = src.slice(src.indexOf('export async function scheduleEveningBrief'), src.indexOf('export async function scheduleShutdownNotification'));
    expect(fn.indexOf("cancelScheduledNotificationAsync('evening-brief')")).toBeLessThan(fn.indexOf('if (completedToday === 0 && pendingTotal === 0) return;'));
  });

  it('haftalık özette her hafta TEK bildirim — tekrarlı yedek yok', () => {
    expect(src).not.toMatch(/type: 'weekly', weekday/);
  });

  it('gizlilik ayarı yalnız hatırlatıcılı görevleri yeniden kurar', () => {
    const fn = src.slice(src.indexOf('export async function rescheduleAllTaskNotifications'), src.indexOf('export async function cancelTaskNotification'));
    expect(fn).toContain("tag === 'hatırlatıcı' || tag === 'reminder'");
  });

  it('sınav başlığında sabit Türkçe ek yok ("YKS\'a" yanlıştı)', () => {
    expect(src).not.toContain("${name}'a ");
  });

  it('kilit ekranı "Tamamla" uygulamanın tek tamamlama yolunu kullanır', () => {
    expect(layout).not.toMatch(/patch\(`\/tasks\//);
    expect(layout).toContain('completeTask(taskId)');
  });

  it('özetler sayılar değişince yeniden kurulur', () => {
    expect(layout).toMatch(/productivityHour, notifSig\]\);/);
  });
});
