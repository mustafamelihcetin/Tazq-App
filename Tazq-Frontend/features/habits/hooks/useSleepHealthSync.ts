import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useHabitStore, fmtDateKey, type Habit } from '../store/useHabitStore';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useToastStore } from '@/shared/store/useToastStore';
import { SleepHealth, formatSleepDuration } from '@/shared/services/sleepHealth';
import { recoveryFromSleep } from '@/shared/utils/recovery';
import { isSleepHabit } from '@/features/habits/utils/sleepHabit';

/**
 * Uyku sağlık senkronu — hedef-bazlı, "onaylı asistan" (iOS HealthKit / Android Health Connect).
 *
 * Mantık (bağlıyken, opt-in 'yes'):
 *  - Hedef TUTULDU (uyku ≥ seçilen saat) → habit OTOMATİK işaretlenir + "🎉" toast (Geri al'lı).
 *  - Hedef TUTULMADI (gerçek bir gece uykusu var ama az) → İŞARETLEMEZ; nazik BİLGİ toast'ı
 *    ("Dün gece Xs · hedef Ys") + "İşaretle" aksiyonu (kullanıcı isterse tek dokunuşla). Başarısız damgası YOK.
 *  - Anlamlı gece uykusu yok (veri yok / < eşik) → tamamen sessiz, günü tüketmeden 15 dk'da bir tekrar dene.
 *  - Bağlı değil (opt-in 'yes' değil) → tamamen elle (eski usül), hiçbir şey gösterme.
 *
 * Dayanıklılık: uyku habit'i isim/emoji ile de tanınır (etiketsiz eskiler); toggleDate öncesi taze kontrol
 *  (yanlış silme yok); veri gelince gün bir kez kapatılır (mark ya da info); native yoksa sessiz no-op.
 */

const MIN_REAL_SLEEP_MIN = 120; // <2 saat: gerçek gece uykusu sayma (şekerleme/yarım senkron) → sessiz, tekrar dene
const RETRY_THROTTLE_MS = 15 * 60 * 1000; // veri yoksa en fazla 15 dk'da bir tekrar dene

/**
 * GERİYE DÖNÜK DOLDURMA PENCERESİ (gün).
 *
 * ÖLÇÜLEN SORUN: senkron yalnızca BUGÜNÜ işaretliyordu ve veri katmanı yalnızca son
 * 26 saati okuyordu. Kullanıcı uygulamayı üç gün açmazsa aradaki iki gece,
 * HealthKit/Health Connect'te DURURKEN kayboluyordu — uyku alışkanlığı işaretlenmiyor,
 * SERİ kırılıyor, momentum düşüyordu. Yani uygulama kullanıcıyı uyuduğu hâlde,
 * yalnızca kendisini açmadığı için cezalandırıyordu.
 *
 * NEDEN 4 GÜN VE SONSUZ DEĞİL: geçmişi sınırsız doldurmak, aylar sonra kurulan bir
 * telefonda bütün geçmişi tek seferde "başarı" olarak işaretlerdi — seri de momentum
 * da anlamını yitirirdi. Dört gün, "tatilden döndüm" senaryosunu kurtarır ama geçmişi
 * yeniden yazmaz.
 */
const BACKFILL_DAYS = 4;


/**
 * Bir uyku alışkanlığı için turun sonucu.
 *  · 'marked'  — BU tur işaret koyduk (geri alınabilir)
 *  · 'already' — zaten işaretliydi (kullanıcı elle koymuş olabilir → GERİ ALINAMAZ)
 *  · 'info'    — veri var ama hedef tutmadı
 *  · 'nodata'  — anlamlı uyku verisi yok
 */
type SleepOutcome = 'marked' | 'already' | 'info' | 'nodata';



export function useSleepHealthSync() {
  const habits = useHabitStore(s => s.habits);
  const runningRef = useRef(false);
  const lastAttemptRef = useRef(0); // veri-yok tekrar denemesi için throttle

  const markDone = (habitId: string, todayKey: string) => {
    // Taze kontrol: zaten işaretliyse dokunma (toggle silmesin).
    const cur = useHabitStore.getState().habits.find(h => h.id === habitId);
    if (cur && !(cur.completedDates ?? []).includes(todayKey)) {
      useHabitStore.getState().toggleDate(habitId, todayKey);
    }
  };

  /*
    BİLDİRİM BURADA GÖSTERİLMEZ — kararı `run` verir.

    Bir kullanıcının birden çok uyku alışkanlığı olabilir (plan "Düzenli uyku" ekler,
    kullanıcının kendi "Uyku düzeni" alışkanlığı da olabilir). Döngü her biri için AYRI
    toast gösteriyordu; kuyruğa giren ikinci toast kullanıcı sayfalar arası gezerken
    çıkıp "aynı bildirim tekrar geldi" gibi görünüyordu.

    Oysa bu bildirim ALIŞKANLIK hakkında değil, KULLANICININ UYKUSU hakkında — ve
    kullanıcı bir kez uyudu. Kaç satır eşleştiği kullanıcının bilmesi gereken bir şey
    değil: işaretleme hepsine uygulanır, bildirim bir tanedir.

    (Hangi alışkanlığın uyku sayılacağı ayrı bir sorudur ve artık sleepHabit.ts'te
    tek bir yerde cevaplanıyor — eskiden buradaki gevşek kural spor planının
    "Toparlanma: uyku + aktif dinlenme" alışkanlığını da uyku sayıyordu.)
  */
  const processSleep = useCallback((habitId: string, todayKey: string, mins: number | null): SleepOutcome => {
    if (mins == null || mins < MIN_REAL_SLEEP_MIN) return 'nodata'; // anlamlı uyku yok → sessiz

    const goalHours = usePrefsStore.getState().sleepGoalHours || 7;
    if (mins < goalHours * 60) return 'info'; // veri var ama hedef tutmadı → yalnız bilgi

    /*
      DÖNÜŞ DEĞERİ, GERÇEKTEN İŞARET KOYDUYSAK 'marked'.

      ÖLÇÜLEN SORUN: eskiden hedef tutunca koşulsuz 'marked' dönüyordu — yazma
      korumalıydı (`if (!alreadyDone)`) ama dönüş değeri değildi. `run` bu id'yi
      "işaretledik" listesine ekliyor, toast'ın "Geri al" düğmesi de o listedeki her
      şeyi geri alıyordu. Kullanıcı sağlık verisi okunurken (gerçek bir HealthKit /
      Health Connect turu) alışkanlığı KENDİ işaretlemişse, "Geri al" onun kendi
      işaretini siliyordu.

      Geri alma, ancak YAPTIĞIMIZ şeyi kapsamalı. Zaten işaretliyse yapacak bir şey
      yok ve geri alacak bir şey de yok.
    */
    const fresh = useHabitStore.getState().habits.find(h => h.id === habitId);
    if (fresh && (fresh.completedDates ?? []).includes(todayKey)) return 'already';

    markDone(habitId, todayKey);
    return 'marked';
  }, []);

  /**
   * Tek bildirim — tüm uyku alışkanlıkları işlendikten SONRA bir kez gösterilir.
   *
   * Metin emojisiz: uygulamanın görsel dili düz (flat) ikon. Sistem emojisi hem o dile
   * aykırı hem de platformdan platforma farklı çiziliyor — aynı metin iOS'ta başka,
   * Android'de başka görünür.
   */
  const announce = useCallback((outcome: SleepOutcome, mins: number, habitIds: string[], todayKey: string) => {
    if (outcome === 'nodata' || habitIds.length === 0) return;
    const lang = (useLanguageStore.getState().language === 'en' ? 'en' : 'tr') as 'tr' | 'en';
    const goalHours = usePrefsStore.getState().sleepGoalHours || 7;
    const dur = formatSleepDuration(mins, lang);

    if (outcome === 'marked') {
      useToastStore.getState().show(
        lang === 'tr' ? `Uyku işaretlendi · ${dur}` : `Sleep marked · ${dur}`,
        'success',
        {
          label: lang === 'tr' ? 'Geri al' : 'Undo',
          // Geri alma da HEPSİNİ kapsar: tek bildirim gösterdiysek, tek dokunuş da
          // gösterdiğimiz şeyin tamamını geri almalı.
          onAction: () => {
            for (const id of habitIds) {
              const cur = useHabitStore.getState().habits.find(h => h.id === id);
              if (cur && (cur.completedDates ?? []).includes(todayKey)) useHabitStore.getState().toggleDate(id, todayKey);
            }
          },
        }
      );
      return;
    }

    useToastStore.getState().show(
      lang === 'tr' ? `Son uyku ${dur} · hedef ${goalHours} saat` : `Last sleep ${dur} · goal ${goalHours}h`,
      'info',
      {
        label: lang === 'tr' ? 'İşaretle' : 'Mark',
        onAction: () => { for (const id of habitIds) markDone(id, todayKey); },
      }
    );
  }, []);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    if (!SleepHealth.isSupported()) return;

    const sleepHabits = habits.filter(isSleepHabit);
    if (sleepHabits.length === 0) return;

    const todayKey = fmtDateKey();
    const unmarked = sleepHabits.filter(h => !(h.completedDates ?? []).includes(todayKey));
    if (unmarked.length === 0) return; // hepsi bugün işaretli → iş yok

    runningRef.current = true;
    try {
      const prefs = usePrefsStore.getState();

      // Bağlanma YALNIZ kullanıcı tarafından, AÇIKÇA (Profil → UYKU anahtarı). Burada asla modal gösterme.
      if (prefs.sleepHealthOptIn !== 'yes') return; // bağlı değil → tamamen elle

      // Bugün zaten işlendi (işaretlendi ya da bilgi verildi) → çık
      if (prefs.sleepLastCheckDate === todayKey) return;

      // Veri-yok durumunda hammer'lamamak için throttle
      const nowMs = Date.now();
      if (nowMs - lastAttemptRef.current < RETRY_THROTTLE_MS) return;
      lastAttemptRef.current = nowMs;

      /*
        UYKU VERİSİ BİR KEZ OKUNUR — alışkanlık başına değil.

        Eskiden döngü her alışkanlık için `processSleep` çağırıyordu ve o da HER seferinde
        HealthKit/Health Connect'e ayrı bir sorgu atıyordu. Oysa "dün gece kaç saat uyudun"
        sorusunun cevabı alışkanlığa göre değişmez; iki uyku alışkanlığı olan kullanıcıda
        aynı veri iki kez okunuyordu. Sorgu bir kez yapılıp sonuç hepsine uygulanıyor.
      */
      /*
        TEK PLATFORM OKUMASI — hem "dün gece", hem son N günün dökümü.

        Eskiden iki ayrı okuma vardı (`getRecentSleepMinutes` + `getSleepMinutesByDay`)
        ve geniş pencere darını zaten kapsıyordu: aynı veri iki kez isteniyordu.
        Android'de her okuma bir Health Connect IPC'si + izin kontrolü demek.
        İki cevap birbirinden TÜRETİLEMEZ (son oturum ≠ gün toplamı), o yüzden ikisi de
        hesaplanıyor — ama tek okumadan. Bkz. SleepHealth.getSleepSummary.
      */
      const { lastSession: minsOnce, byDay } = await SleepHealth.getSleepSummary(BACKFILL_DAYS);

      /*
        İKİ AYRI LİSTE — biri geri alınabilir, biri değil.

        `justMarked` yalnız BU turda işaret koyduklarımızı taşır ve toast'ın "Geri al"
        düğmesi tam olarak bunu kapsar. Eskiden tek liste vardı ve 'nodata' olmayan HER
        sonucu topluyordu; içine kullanıcının kendi işaretledikleri de düşüyor, "Geri al"
        onları da siliyordu.

        `touched` ise "gece verisi vardı mı" sorusunun cevabı — günü kapatma kararı buna
        bakar, bildirimin kapsamına değil.
      */
      const justMarked: string[] = [];
      const pendingMark: string[] = [];
      let outcomeOnce: SleepOutcome = 'nodata';
      let dataSeen = false;

      for (const h of unmarked) {
        const outcome = processSleep(h.id, todayKey, minsOnce);
        if (outcome === 'nodata') continue;
        dataSeen = true; // marked / already / info → gece verisi vardı
        if (outcome === 'marked') justMarked.push(h.id);
        // 'info' = hedef tutmadı; toast "İşaretle" eylemi bunları hedefler.
        if (outcome === 'info') pendingMark.push(h.id);
        // 'already' hiçbir listeye girmez: ne geri alınır ne işaretlenir.
        if (outcome !== 'already') outcomeOnce = outcome;
      }

      /*
        BİLDİRİM İŞ BİTER BİTMEZ — geriye doldurmayı BEKLEMEZ.

        Bildirimin ihtiyaç duyduğu her şey bu noktada hazır. Eskiden `announce` geriye
        doldurmadan SONRA çağrılıyordu; arada ikinci bir tam platform sorgusu
        (getSleepMinutesByDay) ve alışkanlık × 4 gün'lük bir döngü vardı. Soğuk bir
        Health Connect okumasında bu saniyeler sürüyor ve toast 4 sn sonra kendini
        kapattığı için kullanıcı başka ekrana geçtikten sonra beliriyordu — yani
        "geç gelen bildirim" sorununu çözmek için taşınan kod, aynı sorunu üretiyordu.
      */
      if (minsOnce != null) {
        announce(outcomeOnce, minsOnce, outcomeOnce === 'marked' ? justMarked : pendingMark, todayKey);
      }

      /*
        GEÇMİŞ GÜNLERİ DOLDUR — bugünden BAĞIMSIZ çalışır.

        Bugün için veri olmasa bile (henüz uyunmadı / senkron gecikti) dünkü ve önceki
        günlerin verisi mevcut olabilir. Bu yüzden `dataSeen` kapısının DIŞINDA.

        SESSİZ: geçmiş günler için toast YOK. "3 gün önce hedefini tuttun" bildirimi
        bilgi değil gürültüdür; kullanıcı o anı yaşamıyor. Yalnız işaret konur ki seri
        ve momentum gerçeği yansıtsın.

        HEDEF TUTMADIYSA İŞARETLENMEZ: geçmişi olduğu gibi bırakıyoruz. Doldurma,
        eksik VERİYİ tamamlamak içindir; eksik BAŞARIYI değil.
      */
      const goalHours = usePrefsStore.getState().sleepGoalHours || 7;

      /*
        TOPARLANMA SİNYALİ BURADA ÜRETİLİYOR — veri zaten elimizde.

        Günlük uyku dökümü geriye doldurma için okunuyordu; aynı veriden plan motorunun
        ihtiyacı olan tek sağlık sinyali de çıkıyor. Ayrı bir okuma yapmak, platformdan
        aynı veriyi ikinci kez istemek olurdu.

        Sinyal kullanıcıya GÖSTERİLMİYOR: "az uyudun" demiyoruz, yalnız o günün plan
        yükünü sessizce hafifletiyoruz (bkz. recovery.ts — sağlık tavsiyesi sınırı).
      */
      usePrefsStore.getState().setRecoveryState(recoveryFromSleep(byDay, goalHours));

      /*
        ── GERİYE DOLGU: ANAHTAR VERİNİN KENDİSİNDEN ────────────────────────────
        Burada `dayKey(new Date() - back)` diye bir tarih YENİDEN KURULUYORDU ve o
        yardımcı, adının altındaki nota ("habit store ile AYNI biçim olmak zorunda")
        rağmen 3 saatlik gece kuşu tamponunu uygulamıyordu. Aynı dosya bugünü
        `fmtDateKey()` ile, geçmiş günleri tamponsuz kuruyordu: gece 00:00–03:00
        arasında ikisi FARKLI günü gösteriyor ve ikisi de aynı `completedDates`
        dizisine yazıyordu — yani alışkanlık, kullanıcının gördüğü günden başka bir
        güne işaretlenebiliyordu.

        Tarihi yeniden kurmaya zaten gerek yok: `byDay`in anahtarları uyanılan günü
        ZATEN taşıyor (bkz. sleepHealth → bucketByDay, oturumun BİTİŞ gününe göre).
        Veriyi tanımlayan anahtarı yazmak, iki tanımın ayrışmasını imkânsız kılıyor.
        Pencere de kendiliğinden sınırlı: `byDay` yalnız BACKFILL_DAYS kadar veri taşır.
      */
      for (const h of sleepHabits) {
        for (const [key, mins] of Object.entries(byDay)) {
          // Bugün (ve ileri tarihli bir kayıt) buradan işlenmez: bugünün uykusu
          // yukarıdaki canlı yolda karşılanıyor. Dize karşılaştırması YYYY-MM-DD'de
          // tarih sırasıyla aynıdır.
          if (key >= todayKey) continue;
          if (mins == null || mins < MIN_REAL_SLEEP_MIN) continue;
          if (mins < goalHours * 60) continue;

          // Taze kontrol: zaten işaretliyse dokunma (toggle SİLERDİ).
          const cur = useHabitStore.getState().habits.find(x => x.id === h.id);
          if (!cur || (cur.completedDates ?? []).includes(key)) continue;

          useHabitStore.getState().toggleDate(h.id, key);
        }
      }
      // Veri geldiyse günü kapat → mark/info günde BİR kez. Veri yoksa kapatma (geç senkron için tekrar dene).
      if (dataSeen) prefs.setSleepLastCheckDate(todayKey);
    } finally {
      runningRef.current = false;
    }
  }, [habits, processSleep, announce]);

  useEffect(() => {
    run();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') run(); });
    return () => sub.remove();
  }, [run]);
}
