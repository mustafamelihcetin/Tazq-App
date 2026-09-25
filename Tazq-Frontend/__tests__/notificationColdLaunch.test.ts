import fs from 'fs';
import path from 'path';

/**
 * "Bildirimden basılı tutup Tamamla dedim, uygulamayı açınca görev tamamlanmamış
 * görünüyordu" — kullanıcı raporu.
 *
 * ── KÖK NEDEN ────────────────────────────────────────────────────────────────
 * `task-complete` eylemi `opensAppToForeground: false` taşıyor (bkz.
 * shared/utils/notifications.ts) — kullanıcı uygulamayı öne getirmeden tamamlıyor.
 * Uygulama o an kapalıysa iOS süreci ARKA PLANDA kısaca ayağa kaldırır; ama
 * `addNotificationResponseReceivedListener` yalnız DİNLEYİCİ ABONE OLDUKTAN SONRA
 * gelen yanıtları yakalar. Süreci başlatan yanıtın kendisi bu akışa hiç girmez —
 * Expo'nun kendi belgelediği davranış. `completeTask` hiç çağrılmıyor, görev
 * sunucuda ve yerelde açık kalıyor.
 *
 * Çözüm: `getLastNotificationResponseAsync()` ile süreci başlatan yanıt AYRICA
 * sorulur; aynı yanıtın iki kez işlenmemesi için istek kimliğine göre tekilleştirilir.
 */
const LAYOUT = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');

describe('bildirim eylemi soğuk başlatmada kaybolmaz', () => {
  it('süreci başlatan yanıt getLastNotificationResponseAsync ile ayrıca sorulur', () => {
    expect(LAYOUT).toContain('getLastNotificationResponseAsync');
  });

  it('hem soğuk başlatma hem canlı dinleyici AYNI işleyiciyi kullanır', () => {
    // İki ayrı kopya kolayca ayrışır (biri düzeltilip öteki unutulur) — tek fonksiyon.
    const handlerBlock = LAYOUT.slice(LAYOUT.indexOf('const handleResponse'), LAYOUT.indexOf('Notifs.getLastNotificationResponseAsync'));
    expect(handlerBlock).toContain("action === 'task-complete'");
    expect(LAYOUT).toContain('Notifs.addNotificationResponseReceivedListener(handleResponse)');
  });

  it('aynı bildirim yanıtı iki kaynaktan gelse de yalnız BİR KEZ işlenir', () => {
    expect(LAYOUT).toContain('handledNotifIds');
    expect(LAYOUT).toContain('handledNotifIds.current.has(reqId)');
  });

  it("task-complete kendi başına idempotent — completeTask zaten bitmiş görevi atlar", () => {
    const actions = fs.readFileSync(path.join(__dirname, '..', 'features', 'tasks', 'utils', 'taskActions.ts'), 'utf8');
    const fn = actions.slice(actions.indexOf('export async function completeTask'), actions.indexOf('export async function completeTask') + 400);
    expect(fn).toContain("if (!task || task.isCompleted) return 'skipped';");
  });
});
