import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { swallow } from '@/shared/utils/swallow';

/**
 * İKON KISAYOLLARI — uygulama ikonuna basılı tutunca çıkan iki eylem.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * "Uygulamayı açmadan görev ekleyebiliyor muyum?" sorusunun cevabı hayırdı. Oysa bu
 * kategoride en sık tekrarlanan iki iş belli: bir şey eklemek ve odağa başlamak.
 * İkisi de üç dokunuş uzaktaydı (ikon → pano → + → form).
 *
 * ── NEDEN SAVUNMACI YÜKLEME ───────────────────────────────────────────────────
 * `expo-quick-actions` NATIVE bir modül. Derlemede yoksa (eski bir geliştirme
 * derlemesi, Expo Go) `require` patlar. Uygulamadaki mevcut desen bu: cam malzeme,
 * Google Sign-In ve sağlık servisleri de aynı şekilde yükleniyor. Modül yoksa
 * DEĞİŞEN HİÇBİR ŞEY OLMAZ — kısayol görünmez, uygulama normal çalışır.
 *
 * ── NEREDE ÇAĞRILIR ───────────────────────────────────────────────────────────
 * Kök düzende DEĞİL, ana ekranda. Kısayola dokunmak bir GEZİNME başlatıyor; kök
 * düzen henüz gezinme ağacı hazır değilken çalışır ve bu çağrı kaybolur (paketin
 * kendi uyarısı da bu yönde).
 *
 * KISAYOL METİNLERİ İŞLETİM SİSTEMİNDE görünür ama uygulamanın dilinden gelir:
 * kullanıcı uygulamayı Türkçe kullanıyorsa telefon İngilizce olsa bile kısayol
 * Türkçe olur. Dil değiştiğinde liste yeniden yazılıyor.
 */

let QuickActions: any = null;
try {
  QuickActions = require('expo-quick-actions');
} catch (e) {
  // Sessiz: modülün olmaması bir hata değil, desteklenmeyen bir ortam.
}

/** Kısayolların hedefleri — `params.target` ile taşınır, id'den bağımsız. */
export const SHORTCUT_ADD_TASK = 'add-task';
export const SHORTCUT_FOCUS = 'focus';

export function useAppShortcuts() {
  const router = useRouter();
  const t = useLanguageStore(s => s.t);
  const language = useLanguageStore(s => s.language);

  // 1) Kısayolları tanımla / dil değişince tazele.
  useEffect(() => {
    if (!QuickActions?.setItems) return;
    const items = [
      {
        id: SHORTCUT_ADD_TASK,
        title: t.shortcuts.addTask,
        subtitle: t.shortcuts.addTaskSub,
        // iOS'un kendi sistem glifleri: kısayol menüsü bizim ikon setimizi değil,
        // sistemin dilini konuşur (bkz. Apple HIG). Android ikonu isteğe bağlı.
        icon: Platform.OS === 'ios' ? 'compose' : undefined,
        params: { target: SHORTCUT_ADD_TASK },
      },
      {
        id: SHORTCUT_FOCUS,
        title: t.shortcuts.focus,
        subtitle: t.shortcuts.focusSub,
        icon: Platform.OS === 'ios' ? 'play' : undefined,
        params: { target: SHORTCUT_FOCUS },
      },
    ];
    Promise.resolve(QuickActions.setItems(items)).catch((e: unknown) =>
      swallow('appShortcuts.setItems', e),
    );
  }, [language, t]);

  // 2) Dokunulan kısayolu karşıla.
  useEffect(() => {
    if (!QuickActions?.addListener) return;

    const handle = (action: { id?: string; params?: { target?: string } } | null | undefined) => {
      const target = action?.params?.target ?? action?.id;
      /*
        GÖREV EKLEME ekranı açıp BEKLEMİYOR: `action=add` Görevler ekranında hızlı ekleme
        sayfasını doğrudan açıyor (aynı bağlantıyı Haftalık Merkez de kullanıyor — yeni bir
        parametre icat etmek iki farklı yol demekti). Kısayolun sözü "görev ekle";
        kullanıcıyı listeye bırakıp "şimdi + düğmesini bul" demek o sözü tutmamak olurdu.
      */
      if (target === SHORTCUT_ADD_TASK) {
        router.push({ pathname: '/tasks', params: { action: 'add' } });
        return;
      }
      /*
        ODAK ekranı AÇILIR, seans KENDİLİĞİNDEN BAŞLAMAZ. Süre ve mod seçimi kullanıcının;
        yanlış süreyle başlamış bir seansı durdurmak, hiç başlamamış olmaktan kötüdür.
      */
      if (target === SHORTCUT_FOCUS) {
        router.push('/focus');
      }
    };

    // Uygulama kısayolla AÇILDIYSA olay dinleyici kurulmadan önce gelmiş olur.
    if (QuickActions.initial) handle(QuickActions.initial);

    const sub = QuickActions.addListener(handle);
    return () => sub?.remove?.();
  }, [router]);
}
