/**
 * ALT GÖREV KALICILIĞI — işaretleme sunucuya da yazılır.
 *
 * ── HANGİ HATAYI ÇÖZÜYOR ────────────────────────────────────────────────────────
 * Alt göreve dokunmak YALNIZCA yerel listeyi değiştiriyordu; ne sunucuya istek gidiyor
 * ne çevrimdışı kuyruğa kayıt düşüyordu. Yerel liste kalıcı olduğu için işaretleme bir
 * süre duruyor, sonra sessizce kayboluyordu:
 *
 *   1. Kullanıcı alt görevi işaretliyor → ekranda tik çıkıyor (yerel).
 *   2. Uygulama görevleri sunucudan tazeliyor (`getTasks` → `setTasks`).
 *   3. Birleştirme yalnız `completedAt`i ve çevrilmiş başlığı koruyor; ALT GÖREVLER
 *      sunucudan geldiği gibi yazılıyor — yani hepsi `done: false`.
 *   4. Tikler kayboluyor. Kullanıcı açısından "yaptım, uygulama unuttu".
 *
 * Görev ekranında `subtaskSaveTimers` adında bir ref vardı: tanımlanmış, alt bileşene
 * geçilmiş, unmount'ta temizleniyordu — ama HİÇBİR yere yazılmıyordu. Gecikmeli kaydetme
 * planlanmış, bağlanmamış. Bu dosya o eksik halkayı kapatıyor.
 *
 * ── NEDEN GECİKMELİ (DEBOUNCE) ──────────────────────────────────────────────────
 * Kullanıcı çoğu zaman art arda birkaç alt görevi işaretliyor. Her dokunuşta istek
 * atmak hem gereksiz trafik hem de son yazanın kazandığı bir yarış üretir. 800 ms,
 * arka arkaya dokunuşları tek isteğe toplar ama kullanıcı ekrandan çıkmadan yazar.
 *
 * Yerel güncelleme ANINDA yapılıyor (store'da); burada yalnız sunucuya yazma geciktiriliyor.
 */
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { TaskService } from '@/shared/services/api';
import { swallow } from '@/shared/utils/swallow';

const DEBOUNCE_MS = 800;
const timers: Record<number, ReturnType<typeof setTimeout>> = {};

function payloadFor(taskId: number): { subtasks: { text: string; done: boolean }[] } | null {
  const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
  if (!task) return null;
  return { subtasks: (task.subtasks ?? []).map((s) => ({ text: s.text, done: !!s.done })) };
}

function flush(taskId: number): void {
  const payload = payloadFor(taskId);
  if (!payload) return;

  /*
    GEÇİCİ KİMLİK → DAİMA KUYRUĞA.

    Çevrimdışıyken oluşturulan görevin kimliği negatif ve sunucuda henüz yok; doğrudan
    `updateTask(-123)` çağırmak 404 üretirdi. Kuyruğa koyduğumuzda ise senkron döngüsü
    önce `create` işlemini gönderiyor, ardından bu `update`in kimliğini gerçek kimlikle
    değiştiriyor (bkz. useOfflineSync → idMap). Yani sıra kendiliğinden doğru kuruluyor.
  */
  if (taskId < 0 || !useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'update-task', id: taskId, payload });
    return;
  }

  TaskService.updateTask(taskId, payload).catch((err: any) => {
    // Yanıt YOKSA istek hiç ulaşmamıştır (ağ) → kuyruğa al, kaybolmasın.
    // Yanıt VARSA sunucu reddetmiştir; tekrar denemek aynı sonucu verir, iz bırak.
    if (!err?.response) useOfflineQueue.getState().enqueue({ type: 'update-task', id: taskId, payload });
    else swallow('subtaskSync.persist', err);
  });
}

/** Alt görev değişimini (gecikmeli) sunucuya yazar. Aynı görev için çağrılar toplanır. */
export function persistSubtasks(taskId: number): void {
  if (timers[taskId]) clearTimeout(timers[taskId]);
  timers[taskId] = setTimeout(() => {
    delete timers[taskId];
    flush(taskId);
  }, DEBOUNCE_MS);
}

/**
 * Bekleyen tüm yazmaları HEMEN gönderir.
 *
 * Uygulama arka plana alındığında ya da kapatılırken çağrılır: 800 ms'lik pencere
 * dolmadan uygulamadan çıkan kullanıcının son dokunuşu kaybolmasın.
 */
export function flushPendingSubtasks(): void {
  for (const key of Object.keys(timers)) {
    const id = Number(key);
    clearTimeout(timers[id]);
    delete timers[id];
    flush(id);
  }
}
