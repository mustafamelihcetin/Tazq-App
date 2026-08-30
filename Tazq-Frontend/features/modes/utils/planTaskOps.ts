/**
 * planTaskOps — mod bileşenlerinin paylaştığı plan-görev yardımcıları.
 * modlar.tsx'ten çıkarıldı ki her mod bileşeni (Tez, Mülakat, Spor, Sınav...)
 * aynı offline-first silme + tarih formatlama mantığını tek kaynaktan kullansın.
 */
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useCompletionStore } from '@/shared/store/useCompletionStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { TaskService } from '@/shared/services/api';
import { parseDateKey } from '@/shared/utils/dateKey';

/**
 * Bir plan görevini emekliye ayırır: tamamlanmışsa completion journal'a işler,
 * yerelden siler ve offline-first olarak sunucudan siler (çevrimdışı/hatada kuyruğa).
 */
export function retirePlanTask(taskId: number, planMode?: string): void {
  const task = useTaskStore.getState().tasks.find(t => t.id === taskId);
  if (task?.isCompleted) {
    useCompletionStore.getState().record(task.id, task.title, task.completedAt ?? undefined, planMode);
  }
  useTaskStore.getState().removeTask(taskId);
  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'delete-task', id: taskId });
  } else {
    TaskService.deleteTask(taskId).catch((err: any) => {
      if (!err?.response) useOfflineQueue.getState().enqueue({ type: 'delete-task', id: taskId });
    });
  }
}

/**
 * MOD BAŞINA GÖREV ETİKETLERİ — tek kaynak.
 *
 * Daha önce yalnızca `usePlanAdaptations.ts` içinde tanımlıydı ve orada UYGULAMA
 * AÇILIŞINDA çalışan "orphan sweep" tarafından kullanılıyordu. Mod KAPATILDIĞI ANDA
 * ise kartlar yalnız ID tabanlı temizlik yapıyordu (`planTaskIds.forEach(retire)`).
 * Bir görev o listeden düşmüşse (offline tempId→realId kayması, başarısız silme,
 * prefs sıfırlanması) ekranda kalıyor ve ancak bir sonraki açılışta siliniyordu.
 * Kullanıcı için görüntü şu: "modu kapattım ama görevi hâlâ duruyor".
 *
 * NOT: 'weight_entry' bilinçli DIŞARIDA (kilo geçmişi korunur); 'daily' modlar arası
 * ortak olduğundan tek başına kullanılmaz — slot etiketleri (exam/spor/…) günlük
 * görevleri zaten kapsar.
 */
const ALL_EXAM_TAGS = [
  'exam', 'exam2', 'exam3', 'sınav', 'sınav2', 'sınav3', 'yks', 'kpss', 'ales', 'lgs', 'dgs', 'yds',
  'yökdil', 'yokdil', 'ielts', 'toefl', 'tus', 'dus', 'usmle', 'gre', 'gmat', 'msü', 'msu', 'pmyo',
  'oabt', 'öabt', 'aof', 'aöf', 'pte', 'bilsem', 'katiplik', 'kaymakamlik', 'kaymakamlık', 'icra',
  'smmm', 'bekcilik', 'bekçilik', 'sinav_eve', 'sinav_week', 'sinav_sprint_start', 'sinav_60'
];

export const MODE_TASK_TAGS: Record<string, string[]> = {
  exam: ALL_EXAM_TAGS,
  exam2: ALL_EXAM_TAGS,
  exam3: ALL_EXAM_TAGS,
  tez: ['tez', 'tez_weekly', 'tez_final_2weeks', 'tez_sprint_30', 'tez_60'],
  mulakat: ['mulakat', 'mülakat', 'mulakat2', 'mülakat2', 'mulakat3', 'mülakat3', 'mulakat_day', 'mulakat_eve', 'mulakat_3days', 'mulakat_week', 'mulakat_2weeks'],
  mulakat2: ['mulakat2', 'mülakat2', 'mulakat', 'mülakat', 'mulakat3', 'mülakat3', 'mulakat_day', 'mulakat_eve', 'mulakat_3days', 'mulakat_week', 'mulakat_2weeks'],
  mulakat3: ['mulakat3', 'mülakat3', 'mulakat', 'mülakat', 'mulakat2', 'mülakat2', 'mulakat_day', 'mulakat_eve', 'mulakat_3days', 'mulakat_week', 'mulakat_2weeks'],
  spor: ['spor', 'spor2', 'spor3', 'kilo', 'maraton', 'guc', 'güç', 'genel', 'kilo_adapt', 'kilo_measure', 'maraton_taper', 'maraton_race_week', 'maraton_warn', 'maraton_missed', 'maraton_progress', 'guc_deload', 'guc_progress'],
  spor2: ['spor2', 'spor', 'spor3', 'kilo', 'maraton', 'guc', 'güç', 'genel', 'kilo_adapt', 'kilo_measure', 'maraton_taper', 'maraton_race_week', 'maraton_warn', 'maraton_missed', 'maraton_progress', 'guc_deload', 'guc_progress'],
  spor3: ['spor3', 'spor', 'spor2', 'kilo', 'maraton', 'guc', 'güç', 'genel', 'kilo_adapt', 'kilo_measure', 'maraton_taper', 'maraton_race_week', 'maraton_warn', 'maraton_missed', 'maraton_progress', 'guc_deload', 'guc_progress'],
  ramazan: ['ramazan', 'ramazan_kadir'],
  tasarruf: ['tasarruf', 'budget_entry'],
  birakma: ['birakma', 'bırakma'],
};

/**
 * PLAN ÜRETİMİ GÖREVLERİN ETİKET KÜMESİ — "bu görev bizim mi?" sorusunun tek cevabı.
 *
 * Daha önce `usePlanAdaptations.ts` içinde yerel bir sabitti; MODE_TASK_TAGS buraya
 * taşınırken o geride kaldı ve iki dosya aynı soruyu iki ayrı listeyle yanıtlar oldu.
 * Artık tek kaynak burada, `usePlanAdaptations` buradan içeri alıyor.
 *
 * 'daily' listede: modlar arası ortak günlük görevler de plan üretimidir.
 * 'weight_entry' listede DEĞİL ve olmamalı — kilo geçmişi bilinçli olarak modun
 * kapanmasından sağ çıkar (bkz. MODE_TASK_TAGS notu).
 */
export const PLAN_TAGS = [
  'exam', 'exam2', 'exam3', 'tez', 'mulakat', 'mulakat2', 'mulakat3',
  'spor', 'spor2', 'spor3', 'ramazan', 'yks', 'kpss', 'daily', 'tasarruf', 'birakma',
];

/**
 * Ad eşleşmesi için EN KISA ad. 2 karakter fazla cömertti: "ev", "iş", "AB" gibi
 * iki harfli bir hedef adı hemen her başlığın içinde geçer.
 */
const MIN_NAME_MATCH_LEN = 3;

/** PLAN_TAGS + tüm mod etiketleri — ad eşleşmesinin girebileceği tek küme. */
const PLAN_OWNED_TAGS: ReadonlySet<string> = new Set<string>([
  ...PLAN_TAGS,
  ...Object.values(MODE_TASK_TAGS).flat(),
]);

/**
 * Görev bir yaşam modu tarafından mı üretildi?
 *
 * Kullanıcının kendi görevleri de etiket taşır (NLP ayrıştırıcısı 'iş', 'sağlık',
 * 'acil'… ekler) ama o etiketlerin hiçbiri bu kümede değil. Ayrım bu yüzden güvenli.
 */
export function isPlanOwnedTask(task: { tags?: string[] | null }): boolean {
  return (task.tags ?? []).some(tag => PLAN_OWNED_TAGS.has(tag));
}

/**
 * Başlık/ad karşılaştırması için normalleştirme.
 *
 * `toLowerCase()` Türkçede YANLIŞ: JS'in varsayımı İngilizcedir, 'I' → 'i' verir
 * ama Türkçede 'I' → 'ı'dır. "KILO" yazan bir başlık "kilo" ile eşleşiyordu,
 * "IŞIK" ise "ışık" ile eşleşmiyordu — yani eşleşme dile göre rastgele davranıyordu.
 * `toLocaleLowerCase('tr')` ikisini de doğru yapar (bkz. usePlanAdaptations'taki
 * makeClientKey / planDedupeKey — onlar zaten böyle yapıyordu).
 */
function normalizeForMatch(value?: string | null): string {
  return (value ?? '').trim().toLocaleLowerCase('tr');
}

/**
 * Bir modun TÜM görevlerini etikete göre emekliye ayırır — id listesine bakmadan.
 *
 * Mod kapatılırken ÇAĞRILMALI. ID tabanlı temizlik "bildiğimiz" görevleri siler;
 * bu ise "moda ait olan her şeyi" siler. Tamamlanmış görevler de dahildir —
 * `retirePlanTask` onları önce completion journal'a işler, yani istatistik kaybolmaz,
 * sadece aktif listeden kalkar.
 */
export function retireModeTasksByTag(mode: keyof typeof MODE_TASK_TAGS | string, extraName?: string | null): void {
  const tags = MODE_TASK_TAGS[mode] ?? [mode];
  const tagSet = new Set(tags);
  const nameLower = normalizeForMatch(extraName);

  useTaskStore.getState().tasks
    .filter(t => {
      if ((t.tags ?? []).some(tag => tagSet.has(tag))) return true;

      /*
        AD EŞLEŞMESİ YALNIZ PLANIN KENDİ GÖREVLERİNDE — kullanıcının görevinde ASLA.

        ÖLÇÜLEN SORUN: burada `titleLower.includes(nameLower)` vardı ve hiçbir kapısı
        yoktu. `extraName` kullanıcının yazdığı serbest metindir (sınav adı, tasarruf
        hedefi) ya da bir hedef etiketidir. Emoji önekleri kaldırıldıktan sonra spor
        hedefleri düpedüz gündelik ifadelere döndü: "Kilo Yönetimi", "Genel Form".
        Sonuç: modu kapatan kullanıcının KENDİ yazdığı "Kilo yönetimi için diyetisyen
        ara" görevi de eşleşiyor ve `retirePlanTask` onu hem yerelden hem SUNUCUDAN
        kalıcı siliyordu. Geri alma yok, uyarı yok, kullanıcı silindiğini bile görmüyor.

        Ad eşleşmesi yine de GEREKLİ: plan başlıkları adı cümle ORTASINDA taşır
        (ör. "Hafta 3 sprint: tam YKS denemesi çöz"), o yüzden yalnız önek denemek
        öksüz görev bırakır. Doğru sınır ad değil, MÜLKİYET: görev plan tarafından
        üretilmişse adı eşleştirmek serbest, kullanıcı yazdıysa dokunulmaz.
      */
      if (nameLower && nameLower.length >= MIN_NAME_MATCH_LEN && isPlanOwnedTask(t)) {
        const titleLower = normalizeForMatch(t.title);
        if (titleLower && titleLower.includes(nameLower)) return true;
      }
      return false;
    })
    .forEach(t => retirePlanTask(t.id, mode));
}

/**
 * Bir plan görevini bugüne erteler/aktarır (rollover): hem yerelde hem de
 * offline-first olarak sunucuda tarihini bugünün tarihi yapar.
 */
export function rolloverPlanTask(taskId: number, todayStr: string): void {
  const task = useTaskStore.getState().tasks.find(t => t.id === taskId);
  if (!task) return;

  const updatedPayload = { ...task, dueDate: todayStr };
  
  // Local store güncellemesi
  useTaskStore.getState().updateTask(taskId, { dueDate: todayStr });

  // Server güncellemesi (offline-first)
  if (!useNetworkStore.getState().isOnline) {
    useOfflineQueue.getState().enqueue({ type: 'update-task', id: taskId, payload: updatedPayload });
  } else {
    TaskService.updateTask(taskId, updatedPayload as any).catch((err: any) => {
      if (!err?.response) {
        useOfflineQueue.getState().enqueue({ type: 'update-task', id: taskId, payload: updatedPayload });
      }
    });
  }
}


/** Plan tarihini yerelleştirilmiş kısa biçimde formatlar (TR: gg.aa.yyyy, EN: dd MMM yyyy). */
export function formatPlanDate(iso: string | null | undefined, tr: boolean): string {
  if (!iso) return '';
  const d = new Date(iso);
  return tr
    ? d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Tarih geçmiş mi (gün sonu bazlı, 3 saatlik gece toleransı dahil). */
export function isDatePast(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const adjustedNow = new Date();
  adjustedNow.setHours(adjustedNow.getHours() - 3);
  const targetStr = iso.split('T')[0];
  const adjustedNowStr = `${adjustedNow.getFullYear()}-${String(adjustedNow.getMonth() + 1).padStart(2, '0')}-${String(adjustedNow.getDate()).padStart(2, '0')}`;
  return targetStr < adjustedNowStr;
}

/** Bugünden hedef tarihe kalan gün (3 saatlik gece toleransı dahil, geçmiş/boşsa 0). */
export function daysLeftOf(iso: string | null | undefined): number {
  if (!iso || isDatePast(iso)) return 0;
  const adjustedNow = new Date();
  adjustedNow.setHours(adjustedNow.getHours() - 3);
  adjustedNow.setHours(0, 0, 0, 0);
  
  // Anahtar YEREL gece yarisi olarak cozulur; `new Date(iso)` UTC sayip negatif
  // ofsetli saat dilimlerinde bir gun geri kaydiriyordu (bkz. parseDateKey).
  const targetDate = parseDateKey(iso);
  
  const diffMs = targetDate.getTime() - adjustedNow.getTime();
  return Math.max(0, Math.ceil(diffMs / 86400000));
}
