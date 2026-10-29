/*
  `expo-file-system/legacy`: v56'da modül yeni bir `File`/`Paths` API'sine geçti ama
  eski, kararlı arayüz `legacy` girişinden hâlâ sunuluyor. Basit "dosyaya yaz" işi için
  yeni API ek karmaşıklık getiriyor; buradaki tek ihtiyaç bir JSON'u geçici klasöre
  yazmak. Yeni API'ye geçmek gerektiğinde tek dosya değişecek.
*/
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { swallow } from '@/shared/utils/swallow';
import { buildExportPackage, exportToMarkdown, countRecords, type ExportSources } from '@/shared/utils/exportPackage';

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
 *  · İç kimlikler, sistem etiketleri, tercih deposunun iç şeması — temizleme hattı
 *    izin listesiyle çalışır (bkz. exportPackage.ts).
 */

export type ExportFormat = 'json' | 'md';

/** Dosya adı: kullanıcı klasöründe hangisi olduğu anlaşılsın. */
function fileName(format: ExportFormat): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `tazq-verilerim-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.${format}`;
}

export interface ExportResult {
  ok: boolean;
  /** 'no-sharing' → cihaz paylaşımı desteklemiyor; 'write' / 'unknown' → teknik hata. */
  reason?: 'no-sharing' | 'write' | 'unknown';
  itemCount?: number;
}

/**
 * Depolardan HAM girdileri okur — temizleme exportPackage'da.
 *
 * `require` ile GECİKMELİ okunuyor: bu modül store'lardan önce yüklenebilir ve üstten
 * import döngü yaratır (store → toast → export → store). Aynı desen `haptics.ts`te de var.
 *
 * Eski toplayıcıda üç alan sessizce BOŞ çıkıyordu (yanlış alan adı): bütçe (`entries`,
 * doğrusu `log`), odak toplamı ve geçmişi (`totalFocusMinutes`/`sessionHistory` odak
 * deposunda yok; geçmiş useFocusHistoryStore'da). Ödemeler hiç yoktu.
 */
function readSources(): ExportSources {
  const safe = <T,>(fn: () => T, label: string): T | null => {
    try { return fn(); } catch (e) { swallow(`dataExport.${label}`, e); return null; }
  };
  const language = safe(() => require('@/shared/store/useLanguageStore').useLanguageStore.getState().language, 'language') === 'en' ? 'en' : 'tr';
  return {
    language,
    theme: safe(() => require('@/shared/store/useThemeStore').useThemeStore.getState().theme, 'theme'),
    // YALNIZ ad ve e-posta — kimlik ve jeton YOK (bkz. üstteki not).
    user: safe(() => {
      const u = require('@/features/user/store/useAuthStore').useAuthStore.getState().user;
      return { name: u?.name, email: u?.email };
    }, 'user'),
    tasks: safe(() => require('@/features/tasks/store/useTaskStore').useTaskStore.getState().tasks, 'tasks'),
    habits: safe(() => require('@/features/habits/store/useHabitStore').useHabitStore.getState().habits, 'habits'),
    focusSessions: safe(() => require('@/features/report/useFocusHistoryStore').useFocusHistoryStore.getState().sessions, 'focus'),
    achievements: safe(() => {
      const s = require('@/features/user/store/useAchievementStore').useAchievementStore.getState();
      return { unlocked: s.unlocked, unlockedAt: s.unlockedAt };
    }, 'achievements'),
    momentum: safe(() => require('@/features/user/store/useMomentumStore').useMomentumStore.getState().history, 'momentum'),
    weight: safe(() => require('@/features/modes/store/useSporStore').useSporStore.getState().weightLog, 'weight'),
    budget: safe(() => require('@/shared/store/useBudgetStore').useBudgetStore.getState(), 'budget'),
    /*
      BIRAKMA ve KONU İLERLEMESİ — ikisi de kullanıcının kendi verisi ve ikisi de buluta
      gitmiyor; çıkışta cihazdan siliniyor. Dışa aktarma bu veriye ulaşmanın TEK yolu.
    */
    quit: safe(() => require('@/shared/store/useQuitStore').useQuitStore.getState().items, 'quit'),
    subjects: safe(() => require('@/shared/store/useSubjectStore').useSubjectStore.getState().progress, 'subjects'),
    payments: safe(() => require('@/features/payments/store/usePaymentsStore').usePaymentsStore.getState().payments, 'payments'),
    currency: safe(() => require('@/features/payments/store/usePaymentsStore').usePaymentsStore.getState().currency, 'currency'),
    preferences: safe(() => require('@/features/modes/store/usePrefsStore').usePrefsStore.getState(), 'prefs'),
  };
}

export async function exportUserData(format: ExportFormat = 'json'): Promise<ExportResult> {
  try {
    // Paylaşım DESTEĞİ önce kontrol ediliyor: dosyayı yazıp sonra paylaşamamak,
    // kullanıcının erişemeyeceği bir dosya bırakmak demek olurdu.
    if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'no-sharing' };

    /*
      Odak geçmişi yalnız Geri Bakış ekranında tazeleniyordu: o ekrana hiç girmemiş
      kullanıcının dosyasında odak seansı SIFIR çıkıyordu (cihazda doğrulandı). Önce
      tazelenir; çevrimdışıysa ya da 4 sn'de dönmezse cihazdaki kopya kullanılır.
    */
    try {
      const refresh = require('@/features/report/useFocusHistoryStore').useFocusHistoryStore.getState().refresh;
      await Promise.race([refresh(), new Promise((r) => setTimeout(r, 4000))]);
    } catch (e) { swallow('dataExport.refreshFocus', e); }

    const src = readSources();
    const { getLocalizedTaskTitle } = require('@/features/tasks/store/useTaskStore');
    const { visibleTextTags, isSomeday } = require('@/features/tasks/utils/taskTags');
    const pkg = buildExportPackage(src, {
      localizeTitle: (t) => getLocalizedTaskTitle(t, src.language === 'tr'),
      visibleTags: visibleTextTags,
      isSomeday,
      achievementName: (id) => {
        const a = require('@/features/user/utils/achievements').ACHIEVEMENTS[id];
        return a ? (src.language === 'tr' ? a.titleTr : a.titleEn) : null;
      },
    });
    const content = format === 'md' ? exportToMarkdown(pkg, src.language) : JSON.stringify(pkg, null, 2);

    const dir = FileSystem.cacheDirectory;
    if (!dir) return { ok: false, reason: 'write' };
    const uri = `${dir}${fileName(format)}`;

    await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(uri, format === 'md'
      ? { mimeType: 'text/markdown', dialogTitle: 'TAZQ verilerim', UTI: 'net.daringfireball.markdown' }
      : { mimeType: 'application/json', dialogTitle: 'TAZQ verilerim', UTI: 'public.json' });

    return { ok: true, itemCount: countRecords(pkg) };
  } catch (e) {
    swallow('dataExport.exportUserData', e);
    return { ok: false, reason: 'unknown' };
  }
}
