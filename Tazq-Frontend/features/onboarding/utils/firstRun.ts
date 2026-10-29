import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { create } from 'zustand';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';

/**
 * İLK KULLANIM KURALLARI — TEK YERDE.
 *
 * ── NEDEN TEK YERDE ───────────────────────────────────────────────────────────
 * Aynı iki karar (örnek veri ne zaman görünür, tur ne zaman açılır) üç ekranda üç
 * ayrı şekilde yazılmıştı ve üçü de farklı davranıyordu:
 *
 *   · Görevler : tur `tasks.length > 0` ile REAKTİF bağlıydı
 *   · Ana ekran: aynı reaktif bağ, üstüne `profileSetupVisible` kontrolü
 *   · Kokpit   : hiçbir koşul yok, ekrana girer girmez açılıyordu
 *
 * Örnek veri de beş ayrı yerde elle yazılmış aynı koşulu taşıyordu. Bu akışa yalnız
 * YENİ bir hesabın ilk dakikasında düşülüyor; yani ayrışmalar günlük kullanımda hiç
 * görünmüyor ve canlıya kadar gidiyor. Nitekim gitti — üç kusuru da kullanıcı bildirdi.
 */

export type FirstRunPage = 'dashboard' | 'tasks' | 'cockpit' | 'modlar' | 'focus';

/*
  ── İLK KULLANIM SENARYOSU (2026-09 yeniden kuruldu) ────────────────────────────
  Kayıt → HOŞ GELDİN (profil kurulumu, yalnız ana sayfada) → ana sayfa TURU → her
  sayfanın turu o sayfaya İLK girişte, bir kez. Tur açıkken ve kullanıcının o sayfada
  gerçek verisi yokken arkada ÖRNEK VERİ görünür; tur bitince/atlanınca kaybolur.

  ── ÖNCEKİ HÂLİN KUSURLARI ─────────────────────────────────────────────────────
   · Üç ekranın turu ancak GERÇEK içerik varken açılıyor, örnek veri ise ancak içerik
     YOKKEN çiziliyordu: ikisi hiç aynı anda olmuyordu. Yeni kullanıcı ilk ziyarette
     tur görmüyor, sahte liste ise tur olmadan ekranda kalıp kullanıcının kendi işi
     sanılıyordu ("Hesapsız dene" ile girenlerde ilk gerçek göreve kadar).
   · Odak ekranının turunda hiçbir kapı yoktu (arka plandayken de açılabilirdi).
*/

/**
 * TUR KAPISI — bu sayfanın turu ŞU AN açık olmalı mı?
 *
 * Açık: sayfa ÖNDE + tercihler diskten okundu + bu sayfanın turu tamamlanmadı +
 * çağıran bekletmiyor (`blocked`: ana sayfada hoş geldin ekranı).
 *
 * Kullanıcının eylemine BAĞLI DEĞİL: görev eklemek turu açmaz (eskiden içerik şartı
 * reaktifti ve tur "görev eklemek bir pop-up açtı" gibi okunuyordu).
 *
 * ÖNDE olma şartı korunuyor: sekmeli gezinmede ekranlar sökülmeden bekliyor; arka
 * plandaki bir ekranın turu, kullanıcı başka sayfadayken görünmemeli (kullanıcı Modlar'da
 * Haftalık Merkez'in tanıtımını görmüştü).
 */
export function useTourGate(page: FirstRunPage, blocked = false): boolean {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const hydrated = usePrefsStore((s) => s._hasHydrated);
  const done = usePrefsStore((s) => s.completedTours?.[page] === true);
  return focused && hydrated && !done && !blocked;
}

/**
 * ÖRNEK VERİ KAPISI — tur ÇALIŞTIĞI SÜRECE açık, tur bittiği karede kapalı.
 *
 * Kural değişti (2026-10-25, kullanıcı kararı): eskiden yalnız gerçek veri SIFIRKEN
 * açılıyordu. Tanıtımdaki başlangıç görevi kurtarılınca (bkz. guestMode.test) görev
 * sayısı 1 oldu ve tur yarı boş bir ekranı anlatmaya başladı: halkalar "—", liste tek
 * satır. Tur ekranı DOLU ve anlatılan her şeyi gösterir hâlde anlatmalı; bitince aynı
 * karede gerçeğe döner (`completedTours[page]` → `tourOn` düşer, `running` temizlenir).
 *
 * Gerçek veri SİLİNMEZ ve değişmez — yalnız tur sürerken ekranda örnek gösterilir.
 * Örnek öğeler dokunulamaz (kimlik öneki `mock-`, bkz. index.tsx isDemoId).
 * Parametre korunuyor: çağıran gerçek koleksiyonun uzunluğunu verir (bkz.
 * activationFlow.test → "her çağrı gerçek koleksiyonun uzunluğunu veriyor").
 */
export function useDemoGate(page: FirstRunPage, tourOn: boolean) {
  // Teklif (balon) dururken sayfa değişmez; yalnız tur ÇALIŞIRKEN örnek görünür.
  const running = useTourRun((s) => s.running === page);
  return useCallback((_realCount: number) => tourOn && running, [tourOn, running]);
}

/*
  ── TURUN ÇALIŞMA DURUMU (2026-10-25) ────────────────────────────────────────────
  Ana sayfa turu kendiliğinden başlar; diğer sayfalarda önce bir "Bu sayfayı tanı"
  balonu çıkar (react-joyride beacon deseni, kullanıcı kararı). İki durum ayrı:
    · teklif (tourOn, balon) — sayfa olduğu gibi kalır
    · çalışıyor (running)    — örnek veri görünür, vurgulama açık
  `requested`: kullanıcı turu elle istedi (ör. Modlar'daki ⓘ) → balon atlanır.
  Kalıcı DEĞİL: oturum durumu.
*/
interface TourRunState {
  running: FirstRunPage | null;
  requested: FirstRunPage | null;
  setRunning: (page: FirstRunPage | null) => void;
  request: (page: FirstRunPage) => void;
  clearRequest: () => void;
}

export const useTourRun = create<TourRunState>((set) => ({
  running: null,
  requested: null,
  setRunning: (running) => set({ running }),
  request: (requested) => set({ requested }),
  clearRequest: () => set({ requested: null }),
}));

/**
 * TUR TEKLİFİNİN KENDİLİĞİNDEN EMEKLİLİĞİ (kullanıcı kararı 2026-10-29).
 *
 * Teklif her girişte çıkıyor, kaldırmanın tek yolu ×'ti. Teklifi GÖREN ama dokunmadan
 * ayrılan kullanıcı büyük olasılıkla turu istemiyor; onu × aramaya zorlamak, aynı
 * soruyu her girişte yeniden sormaktır. Eşik "gördü mü": sekmeler arası hızlı geçişte
 * teklif fark edilmemiş olabilir, bir şans daha verilir. Tur her zaman Ayarlar'dan açılır.
 */
export const BEACON_SEEN_MS = 3000;

export function shouldRetireBeacon({ visibleMs, started }: { visibleMs: number; started: boolean }): boolean {
  return !started && visibleMs >= BEACON_SEEN_MS;
}
