import fs from 'fs';
import path from 'path';

/**
 * ALT GÖREV KALICILIĞI — "işaretledim, reload edince yok oldu" hatasının testi.
 *
 * ── ZİNCİR ──────────────────────────────────────────────────────────────────────
 *  1. Kullanıcı alt görevi işaretliyor → `toggleSubtask` YALNIZCA yerel listeyi güncelliyor.
 *     Ne sunucuya istek gidiyor ne çevrimdışı kuyruğa kayıt düşüyor.
 *  2. Yerel liste kalıcı olduğu için tik bir süre duruyor — hata bu yüzden hemen fark
 *     edilmiyor.
 *  3. Uygulama görevleri sunucudan tazeliyor (`getTasks` → `setTasks`). Birleştirme yalnız
 *     `completedAt`i ve çevrilmiş başlığı koruyor; ALT GÖREVLER sunucudan geldiği gibi
 *     yazılıyor, yani hepsi `done: false`.
 *  4. Tikler kayboluyor. Kullanıcı açısından: "yaptım, uygulama unuttu."
 *
 * ── NEDEN GÖZDEN KAÇTI ──────────────────────────────────────────────────────────
 * Görev ekranında `subtaskSaveTimers` adında bir ref vardı: tanımlanmış, alt bileşene
 * prop olarak geçilmiş, unmount'ta temizleniyordu — ama hiçbir yere YAZILMIYORDU.
 * Gecikmeli kaydetme planlanmış, hiç bağlanmamış. Koda bakan biri kaydetmenin var
 * olduğunu sanıyordu.
 */
const STORE = fs.readFileSync(
  path.resolve(__dirname, '../features/tasks/store/useTaskStore.ts'),
  'utf8',
);
const SYNC = fs.readFileSync(
  path.resolve(__dirname, '../features/tasks/utils/subtaskSync.ts'),
  'utf8',
);
const TASKS_SCREEN = fs.readFileSync(
  path.resolve(__dirname, '../app/tasks.tsx'),
  'utf8',
);

describe('işaretleme sunucuya yazılıyor', () => {
  it('toggleSubtask kalıcılığı tetikliyor', () => {
    expect(STORE).toMatch(/persistSubtasks\(taskId\)/);
  });

  it('kalıcılık STORE\'da — çağrı noktasında değil', () => {
    /*
      Kritik tasarım kararı: alt görev işaretlemesi ileride başka bir ekrandan da
      yapılabilir. Kalıcılık çağıranın sorumluluğunda olsaydı, o ekranı yazan kişi adımı
      unuttuğunda hata sessizce geri gelirdi. Store tek giriş noktası.
    */
    const toggleAt = STORE.indexOf('toggleSubtask: (taskId, subtaskIndex)');
    const persistAt = STORE.indexOf('persistSubtasks(taskId)');
    expect(toggleAt).toBeGreaterThan(-1);
    expect(persistAt).toBeGreaterThan(toggleAt);
  });
});

describe('çevrimdışı ve geçici kimlik güvenli', () => {
  it('çevrimdışıyken kuyruğa alınıyor — kaybolmuyor', () => {
    expect(SYNC).toMatch(/!useNetworkStore\.getState\(\)\.isOnline/);
    expect(SYNC).toMatch(/enqueue\(\{ type: 'update-task', id: taskId, payload \}\)/);
  });

  it('geçici (negatif) kimlikte doğrudan istek atılmıyor', () => {
    // `updateTask(-123)` 404 üretirdi. Kuyruğa konunca senkron döngüsü önce `create`i
    // gönderip bu `update`in kimliğini gerçek kimlikle değiştiriyor (idMap).
    expect(SYNC).toMatch(/if \(taskId < 0 \|\| !useNetworkStore\.getState\(\)\.isOnline\)/);
  });

  it('ağ hatasında kuyruğa düşüyor, sunucu reddinde düşmüyor', () => {
    // Yanıt yoksa istek hiç ulaşmamıştır → tekrar denenmeli.
    // Yanıt varsa sunucu reddetmiştir → tekrar denemek aynı sonucu verir.
    expect(SYNC).toMatch(/if \(!err\?\.response\) useOfflineQueue/);
    expect(SYNC).toMatch(/else swallow\('subtaskSync\.persist', err\)/);
  });
});

describe('bekleyen yazma kaybolmuyor', () => {
  it('gecikme penceresi var ama sonsuz değil', () => {
    expect(SYNC).toMatch(/const DEBOUNCE_MS = 800;/);
  });

  it('arka plana geçişte bekleyenler hemen gönderiliyor', () => {
    // 800 ms dolmadan uygulamadan çıkan kullanıcının son dokunuşu kaybolmamalı.
    const layout = fs.readFileSync(path.resolve(__dirname, '../app/_layout.tsx'), 'utf8');
    expect(SYNC).toMatch(/export function flushPendingSubtasks\(\)/);
    expect(layout).toMatch(/flushPendingSubtasks\(\)/);
  });
});

describe('yanıltıcı ölü mekanizma kalmadı', () => {
  it('kullanılmayan subtaskSaveTimers ref\'i yok', () => {
    // Yalnız neden kaldırıldığını anlatan not kalabilir; çalışan kod kalmamalı.
    expect(TASKS_SCREEN).not.toMatch(/const subtaskSaveTimers = useRef/);
    expect(TASKS_SCREEN).not.toMatch(/subtaskSaveTimers=\{subtaskSaveTimers\}/);
    expect(TASKS_SCREEN).not.toMatch(/Object\.values\(subtaskSaveTimers\.current\)/);
  });
});
