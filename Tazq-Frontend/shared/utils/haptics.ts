import * as Expo from 'expo-haptics';

/**
 * TİTREŞİM DİLİ — anlamdan geri bildirime tek eşleme.
 *
 * ÖLÇÜLEN SORUN: uygulamada 392 dokunma noktasına karşılık 296 titreşim çağrısı
 * vardı — her 1.3 dokunmadan biri titriyordu. İki ayrı zarar:
 *
 *  1. YOĞUNLUK. Titreşim sürekli olduğunda bilgi taşımayı bırakır, gürültüye
 *     dönüşür. Apple'ın kendi uygulamalarında oran kabaca 1/8–1/10'dur. Aşırı
 *     haptik, aşırı animasyon ve aşırı renkle birlikte "ucuz uygulama" algısının
 *     klasik üç sinyalinden biridir.
 *
 *  2. TUTARSIZLIK — asıl sorun. Aynı anlamdaki eylem farklı titreşiyordu:
 *       yıkıcı işlem  → Light(7) · Medium(5) · selection(5) · Warning(4) · Heavy(3) · Success(1)
 *       kapat / iptal → Medium(6) · Warning(2) · selection(2) · Success(1)
 *     Haptik bir DİLDİR; aynı kelimeyi altı farklı telaffuzla söylersen kullanıcı
 *     öğrenemez. Doğru kurulduğunda kullanıcı EKRANA BAKMADAN "silindi" ile
 *     "kaydedildi"yi ayırt eder.
 *
 * KURAL: ekranlar `expo-haptics`i doğrudan çağırmaz; ne HİSSETTİRMEK istediğini
 * değil, ne OLDUĞUNU söyler. Şiddet kararı burada, tek yerde verilir.
 *
 * Hepsi `.catch(() => {})` ile sarılı: haptik motoru olmayan cihazda (bazı Android,
 * simülatör) çağrı reddedilir; bu, akışı bozan bir hata olmamalı.
 * Bkz. __tests__/haptics.test.ts
 */

/**
 * Kullanıcı titreşimi kapattıysa hiç çağırma.
 *
 * Kontrol BURADA, tek kapıda: 293 çağrı yerine tek `if`. Merkezileştirmenin
 * asıl kazancı bu — ekranların tercihten haberi bile olmaz.
 *
 * `require` ile gecikmeli okunuyor: bu modül store'dan önce yüklenebilir ve
 * üstten import döngü yaratır (store → toast → haptic → store).
 */
function enabled(): boolean {
  try {
    return require('@/features/modes/store/usePrefsStore').usePrefsStore.getState().hapticFeedback !== false;
  } catch {
    return true; // tercih okunamıyorsa varsayılan: açık
  }
}

const safe = (p: Promise<void>) => { p.catch(() => {}); };

export const haptic = {
  /**
   * SEÇİM DEĞİŞTİ — çip, sekme, switch, radyo, tarih.
   * En hafif geri bildirim; "kaydettim" demez, "duydum" der.
   */
  select: () => { if (enabled()) safe(Expo.selectionAsync()); },

  /**
   * BİR ŞEY AÇILDI/KAPANDI — sheet, modal, genişleyen kart, gezinme.
   * Yüzeyin hareket ettiğini söyler.
   */
  surface: () => { if (enabled()) safe(Expo.impactAsync(Expo.ImpactFeedbackStyle.Light)); },

  /**
   * ONAY GEREKTİREN EYLEM BAŞLADI — plan önizleme, uzun basma, sürükleme kilidi.
   * Kullanıcının "bir şeyi başlattığını" bilmesi gereken an.
   */
  commit: () => { if (enabled()) safe(Expo.impactAsync(Expo.ImpactFeedbackStyle.Medium)); },

  /** İŞLEM BAŞARILI — kaydedildi, tamamlandı, uygulandı. */
  success: () => { if (enabled()) safe(Expo.notificationAsync(Expo.NotificationFeedbackType.Success)); },

  /** İŞLEM BAŞARISIZ — doğrulama hatası, ağ hatası, reddedildi. */
  error: () => { if (enabled()) safe(Expo.notificationAsync(Expo.NotificationFeedbackType.Error)); },

  /** YIKICI İŞLEM ONAYLANDI — silindi, mod kapatıldı, plan kaldırıldı. */
  destructive: () => { if (enabled()) safe(Expo.notificationAsync(Expo.NotificationFeedbackType.Warning)); },

  /**
   * KUTLAMA — başarım açıldı, seri tamamlandı. NADİR olmalı.
   * Tek yerde tutuluyor ki "her tamamlamada kutlama" cazibesine kapılınmasın.
   */
  celebrate: () => { if (enabled()) safe(Expo.notificationAsync(Expo.NotificationFeedbackType.Success)); },
};

/**
 * TİTREŞİM YOK — bilinçli sessizlik.
 *
 * Var olması, gözden kaçmış bir eksik ile KARAR verilmiş sessizliği ayırt etmek
 * için: kod okurken "burada neden haptik yok?" sorusuna cevap verir.
 */
export const noHaptic = () => {};
