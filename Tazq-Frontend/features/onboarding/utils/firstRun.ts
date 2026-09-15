import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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

export type FirstRunPage = 'dashboard' | 'tasks' | 'cockpit' | 'modlar';

/**
 * ÖRNEK VERİ KAPISI.
 *
 * Boş bir ekranı canlandırmak ve tura gösterecek bir şey vermek için birkaç sahte satır
 * çiziliyor. Dört kural var ve dördü de ÖLÇÜLMÜŞ bir sorundan geliyor:
 *
 *  1. TERCİHLER DİSKTEN OKUNMADAN GÖSTERİLMEZ.
 *     `onboardingCompleted` okunana kadar varsayılanı `false`. Bu kontrol olmadan
 *     HER kullanıcı, her soğuk açılışta, gerçek verisi yüklenene kadar sahte satırları
 *     görüyordu — kimse bildirmedi çünkü bir anlık parıltı, ama oradaydı.
 *
 *  2. GERÇEK VERİ VARSA ASLA.
 *     Koşulda bu yoktu ve dal erken dönüp YALNIZCA sahte satırları veriyordu: kullanıcı
 *     ilk görevini ekliyor, kaydediliyor, ama listede görünmüyordu. Bir uygulamanın en
 *     temel sözü, eklediğin şeyin orada durmasıdır.
 *
 *  3. Kullanıcı tanıtımı bitirmişse yok (dönen/reaktive kullanıcı gerçeğini görür).
 *  4. O sayfanın turu tamamlanmışsa yok (anlatılacak bir şey kalmadı).
 *
 * Sayıyı PARAMETRE olarak istiyor: "gerçek veri varsa asla" kuralı böylece çağıran
 * tarafın hatırlamasına kalmıyor, imzanın kendisinden geliyor.
 */
export function useDemoGate(page: FirstRunPage) {
  const hydrated = usePrefsStore((s) => s._hasHydrated);
  const onboardingCompleted = usePrefsStore((s) => s.onboardingCompleted);
  const tourDone = usePrefsStore((s) => s.completedTours?.[page] === true);

  return useCallback(
    (realCount: number) => hydrated && realCount === 0 && !onboardingCompleted && !tourDone,
    [hydrated, onboardingCompleted, tourDone],
  );
}

/**
 * TUR KAPISI — karar ekrana GİRİLİRKEN verilir, kullanıcının eylemiyle değil.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Koşul doğrudan `tasks.length > 0` idi ve reaktifti: kullanıcı ilk görevini ekliyor,
 * dizi doluyor, tur aynı karede önüne atlıyordu. Nedensellik yanlış okunuyordu —
 * "görev eklemek bir pop-up açtı" gibi. Kullanıcı da tam bunu bildirdi.
 *
 * Niyet doğruydu: boş bir ekranda "sola kaydır, ertele" anlatmanın karşılığı yok. Yanlış
 * olan ZAMANLAMAYDI. Karar artık odaklanma anında bir kez alınıp o ziyaret boyunca
 * donuyor: elinde içerik varken girersen tur açılır; buradayken eklediklerin turu
 * tetiklemez. İlk görevini ekleyen kullanıcı turu bir sonraki gelişinde görür — o zaman
 * gösterilecek gerçek bir liste de vardır.
 *
 * @param hasContent O anki içerik durumunu okuyan fonksiyon. Fonksiyon olarak alınıyor
 *                   ki kapanışta eski değere saplanmasın; her odaklanmada GÜNCELİ okur.
 */
export function useTourGate(hasContent: () => boolean) {
  const [allowed, setAllowed] = useState(false);
  const read = useRef(hasContent);
  read.current = hasContent;

  useFocusEffect(
    useCallback(() => {
      setAllowed(read.current());
      /*
        ── ODAKTAN ÇIKAN EKRANIN TURU KAPANIR ────────────────────────────────
        Temizlik YOKTU: bayrak bir kez açılınca ekran arka plana düşse de açık
        kalıyordu. Sekmeli gezinmede ekranlar sökülmeden bekliyor, yani arka
        plandaki bir ekranın turu ayakta kalabiliyor ve kullanıcı başka bir
        sayfadayken karşısına o sayfanın anlatımı çıkabiliyordu — kullanıcı da
        tam bunu bildirdi: Modlar'dayken Haftalık Merkez'in tanıtımını gördü.

        Bir tur, yalnız ANLATTIĞI ekran öndeyken görünebilir.
      */
      return () => setAllowed(false);
    }, []),
  );

  return allowed;
}
