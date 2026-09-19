import { useCallback, useState } from 'react';
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
 * ÖRNEK VERİ KAPISI — yalnız TUR AÇIKKEN ve gerçek veri YOKKEN.
 *
 * Tur bitince (ya da atlanınca) `completedTours[page]` true olur, `tourOn` düşer ve
 * örnek satırlar aynı karede kaybolur. Gerçek verisi olan kullanıcı örnek görmez:
 * eklediğin şeyin orada durması, uygulamanın en temel sözü.
 *
 * Gerçek sayıyı PARAMETRE olarak istiyor — "gerçek veri varsa asla" kuralı çağıranın
 * hatırlamasına kalmıyor, imzadan geliyor.
 */
export function useDemoGate(_page: FirstRunPage, tourOn: boolean) {
  return useCallback((realCount: number) => tourOn && realCount === 0, [tourOn]);
}
