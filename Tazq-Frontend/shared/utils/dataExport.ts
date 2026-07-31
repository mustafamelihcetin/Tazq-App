/*
  `expo-file-system/legacy`: v56'da modül yeni bir `File`/`Paths` API'sine geçti ama
  eski, kararlı arayüz `legacy` girişinden hâlâ sunuluyor. Basit "dosyaya yaz" işi için
  yeni API ek karmaşıklık getiriyor; buradaki tek ihtiyaç bir JSON'u geçici klasöre
  yazmak. Yeni API'ye geçmek gerektiğinde tek dosya değişecek.
*/
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { swallow } from '@/shared/utils/swallow';

/**
 * VERİLERİMİ DIŞA AKTAR.
 *
 * NEDEN GEREKLİ:
 *  1. GÜVEN — kullanıcı verisinin bulutta olduğunu bilmiyor. Uygulama silinirse ya da
 *     telefon kaybolursa ne olacağını da bilmiyor. "İndir" düğmesi bu belirsizliği
 *     kapatıyor; kullanıcı veriyi ELİNDE tutabildiğini görünce uygulamaya güveniyor.
 *  2. YASAL — KVKK ve GDPR "veri taşınabilirliği" hakkı tanıyor: kullanıcı verisini
 *     makine-okunur bir biçimde isteyebilir. Hesap SİLME zaten var; taşınabilirlik
 *     eksikti. Play Store da veri politikası tarafında bunu olumlu sayıyor.
 *
 * NE DIŞA AKTARILMIYOR — bilinçli:
 *  · Oturum jetonları (JWT / refresh token). Bir dosyaya yazılan jeton, o dosyayı
 *    eline geçiren herkes için hesap erişimi demektir. Dışa aktarma dosyası
 *    WhatsApp'tan gönderilebilen bir şey; sır taşımamalı.
 *  · Parola (zaten cihazda yok, sunucuda PBKDF2 ile saklanıyor).
 *  · Geçici/türetilmiş durum (ağ durumu, animasyon sayaçları) — veri değil.
 */

/** Dosya adı: kullanıcı klasöründe hangisi olduğu anlaşılsın. */
function fileName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `tazq-verilerim-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export interface ExportResult {
  ok: boolean;
  /** 'no-sharing' → cihaz paylaşımı desteklemiyor; 'write' / 'unknown' → teknik hata. */
  reason?: 'no-sharing' | 'write' | 'unknown';
  itemCount?: number;
}

/**
 * Store'lardan kullanıcı verisini toplar.
 *
 * `require` ile GECİKMELİ okunuyor: bu modül store'lardan önce yüklenebilir ve üstten
 * import döngü yaratır (store → toast → export → store). Aynı desen `haptics.ts`te de var.
 */
function collect(): Record<string, unknown> {
  const safe = <T,>(fn: () => T, label: string): T | null => {
    try { return fn(); } catch (e) { swallow(`dataExport.${label}`, e); return null; }
  };

  const user = safe(() => {
    const s = require('@/features/user/store/useAuthStore').useAuthStore.getState();
    // YALNIZ kimlik alanları — jeton YOK (bkz. üstteki not).
    return { id: s.user?.id, name: s.user?.name, email: s.user?.email };
  }, 'user');

  return {
    // Sürüm alanı: biçim ileride değişirse içe aktarma tarafı hangi şemayla
    // konuştuğunu bilsin. Sürümsüz bir dışa aktarma, bir kez değişince çöp olur.
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    app: 'TAZQ',
    user,
    tasks: safe(() => require('@/features/tasks/store/useTaskStore').useTaskStore.getState().tasks, 'tasks'),
    habits: safe(() => require('@/features/habits/store/useHabitStore').useHabitStore.getState().habits, 'habits'),
    focus: safe(() => {
      const s = require('@/features/focus/store/useFocusStore').useFocusStore.getState();
      return { totalMinutes: s.totalFocusMinutes, focusPoints: s.focusPoints, history: s.sessionHistory };
    }, 'focus'),
    achievements: safe(() => {
      const s = require('@/features/user/store/useAchievementStore').useAchievementStore.getState();
      return { unlocked: s.unlocked, unlockedAt: s.unlockedAt };
    }, 'achievements'),
    momentum: safe(() => require('@/features/user/store/useMomentumStore').useMomentumStore.getState().history, 'momentum'),
    weight: safe(() => require('@/features/modes/store/useSporStore').useSporStore.getState().weightLog, 'weight'),
    budget: safe(() => require('@/shared/store/useBudgetStore').useBudgetStore.getState().entries, 'budget'),
    preferences: safe(() => {
      const s = require('@/features/modes/store/usePrefsStore').usePrefsStore.getState();
      // Fonksiyonlar ve setter'lar hariç — yalnız değerler.
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(s)) {
        if (typeof v === 'function') continue;
        if (k.startsWith('_')) continue;
        out[k] = v;
      }
      return out;
    }, 'prefs'),
  };
}

/** Dışa aktarılan kayıt sayısı — kullanıcıya "ne kadar veri" olduğunu söylemek için. */
export function countItems(data: Record<string, unknown>): number {
  let n = 0;
  for (const v of Object.values(data)) {
    if (Array.isArray(v)) n += v.length;
  }
  // İç içe diziler (focus.history gibi) da sayılsın.
  const focus = data.focus as { history?: unknown[] } | null;
  if (focus?.history && Array.isArray(focus.history)) n += focus.history.length;
  return n;
}

export async function exportUserData(): Promise<ExportResult> {
  try {
    // Paylaşım DESTEĞİ önce kontrol ediliyor: dosyayı yazıp sonra paylaşamamak,
    // kullanıcının erişemeyeceği bir dosya bırakmak demek olurdu.
    if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'no-sharing' };

    const data = collect();
    const json = JSON.stringify(data, null, 2);

    const dir = FileSystem.cacheDirectory;
    if (!dir) return { ok: false, reason: 'write' };
    const uri = `${dir}${fileName()}`;

    await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'TAZQ verilerim',
      UTI: 'public.json',
    });

    return { ok: true, itemCount: countItems(data) };
  } catch (e) {
    swallow('dataExport.exportUserData', e);
    return { ok: false, reason: 'unknown' };
  }
}
