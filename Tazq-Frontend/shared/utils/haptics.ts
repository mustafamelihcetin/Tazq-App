import { Platform, Vibration } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
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

/*
  ── NATIVE MODÜL GERÇEKTEN VAR MI ────────────────────────────────────────────
  expo-haptics yamalı (patches/expo-haptics+56.0.3.patch): modül yoksa hata
  fırlatmak yerine SESSİZCE dönüyor. Üstüne `safe()` da yutunca, haptik modülü
  derlenmemiş bir ikilide 320 çağrının hepsi iz bırakmadan boşa gidiyordu —
  "titreşim açık ama hiçbir şey titremiyor" şikâyetinin teşhis edilemeyen hâli.
  Artık geliştirmede bir kez söyleniyor; galeri ekranı da durumu gösteriyor.
*/
export const hapticsAvailable = (): boolean => requireOptionalNativeModule('ExpoHaptics') != null;
let warned = false;
const checkAvailable = () => {
  if (warned || !__DEV__) return;
  warned = true;
  if (!hapticsAvailable()) console.warn("[haptics] ExpoHaptics native modülü bu ikilide YOK — titreşimler çalışmaz. Dev client'ı yeniden derleyin.");
};

/*
  ── ANDROID: SİSTEMİN KENDİ DOKUNSAL DİLİ ────────────────────────────────────
  expo-haptics'in impact/selection'ı Android'de ham motor titreşimi üretir:
  50 ms, genlik 30/255. Modern LRA motorlarda bu neredeyse hissedilmez — ve
  çağrıların %70'i (select + surface) tam bu ikisi. Expo dokümanının önerdiği
  `performAndroidHapticsAsync`, View.performHapticFeedback'i, yani Android'in
  HapticFeedbackConstants standardını kullanır: kalibre edilmiş, sistemin
  "dokunma titreşimi" ayarına saygılı, iOS'a en yakın his.
  Bazı sabitler API 30/34+; desteklenmeyende fırlatır → her yerde olan yedeğe düş.
*/
type AndroidKind = 'segment-tick' | 'clock-tick' | 'context-click' | 'long-press' | 'confirm' | 'reject' | 'virtual-key';
const androidFeedback = (primary: AndroidKind, fallback: AndroidKind) => {
  const perform = (Expo as unknown as { performAndroidHapticsAsync?: (t: string) => Promise<void> }).performAndroidHapticsAsync;
  if (!perform) return;
  perform(primary).catch(() => perform(fallback).catch(() => {}));
};

/** iOS'ta Taptic Engine API'si; Android'de sistemin eşdeğer sabiti. */
const play = (ios: () => Promise<void>, android: AndroidKind, androidFallback: AndroidKind) => {
  checkAvailable();
  if (Platform.OS === 'android') androidFeedback(android, androidFallback);
  else safe(ios());
};

export const haptic = {
  /**
   * SEÇİM DEĞİŞTİ — çip, sekme, switch, radyo, tarih.
   * En hafif geri bildirim; "kaydettim" demez, "duydum" der.
   */
  select: () => { if (enabled()) play(() => Expo.selectionAsync(), 'segment-tick', 'clock-tick'); },

  /**
   * BİR ŞEY AÇILDI/KAPANDI — sheet, modal, genişleyen kart, gezinme.
   * Yüzeyin hareket ettiğini söyler.
   */
  surface: () => { if (enabled()) play(() => Expo.impactAsync(Expo.ImpactFeedbackStyle.Light), 'context-click', 'virtual-key'); },

  /**
   * ONAY GEREKTİREN EYLEM BAŞLADI — plan önizleme, uzun basma, sürükleme kilidi.
   * Kullanıcının "bir şeyi başlattığını" bilmesi gereken an.
   */
  commit: () => { if (enabled()) play(() => Expo.impactAsync(Expo.ImpactFeedbackStyle.Medium), 'long-press', 'long-press'); },

  /** İŞLEM BAŞARILI — kaydedildi, tamamlandı, uygulandı. */
  success: () => { if (enabled()) play(() => Expo.notificationAsync(Expo.NotificationFeedbackType.Success), 'confirm', 'context-click'); },

  /** İŞLEM BAŞARISIZ — doğrulama hatası, ağ hatası, reddedildi. */
  error: () => { if (enabled()) play(() => Expo.notificationAsync(Expo.NotificationFeedbackType.Error), 'reject', 'long-press'); },

  /** YIKICI İŞLEM ONAYLANDI — silindi, mod kapatıldı, plan kaldırıldı. */
  destructive: () => { if (enabled()) play(() => Expo.notificationAsync(Expo.NotificationFeedbackType.Warning), 'reject', 'long-press'); },

  /**
   * KUTLAMA — başarım açıldı, seri tamamlandı. NADİR olmalı.
   * Tek yerde tutuluyor ki "her tamamlamada kutlama" cazibesine kapılınmasın.
   */
  celebrate: () => { if (enabled()) play(() => Expo.notificationAsync(Expo.NotificationFeedbackType.Success), 'confirm', 'long-press'); },

  /**
   * ALARM — odak seansı bitti. Dokunuş geri bildirimi DEĞİL, bir uyarı.
   * Android'de View.performHapticFeedback sistemin "dokunma titreşimi" ayarına bağlı;
   * kapalıysa (Huawei Y6'da varsayılan) bitiş hiç titremiyordu. Telefon masada ters
   * dururken seansın bittiğini bilmenin tek yolu bu — o yüzden motor doğrudan sürülür.
   * Uygulamanın kendi titreşim ayarına yine uyar.
   */
  alarm: () => {
    if (!enabled()) return;
    if (Platform.OS === 'android') Vibration.vibrate([0, 70, 110, 70]); // iki kısa vuruş, çanın iki notasıyla
    else safe(Expo.notificationAsync(Expo.NotificationFeedbackType.Success));
  },
  /**
   * NEFES FAZI — "şimdi al / ver". Gözler kapalıyken tek yol gösterici; alarm gibi
   * sistem dokunma ayarından bağımsız (Android'de motor doğrudan, çok kısa ve hafif).
   */
  breath: () => {
    if (!enabled()) return;
    if (Platform.OS === 'android') Vibration.vibrate(28);
    else safe(Expo.impactAsync(Expo.ImpactFeedbackStyle.Soft));
  },
  /**
   * AÇILIŞ KOREOGRAFİSİ (2026-10-31, kullanıcı: "titreşim de buna uygun, hisli olmalı"). Hareketle
   * senkron kısa bir dokunsal cümle: yumuşak (kuşak oturur) · tık · tık (sözcükler) · sert (tik atılır).
   * Android'de TEK desen olarak gönderilir: zamanlama JS iş parçacığına bağlı kalmaz (açılışta meşgul)
   * ve sistemin "dokunma titreşimi" ayarından bağımsızdır (alarm/nefes gibi). iOS: Soft/Selection/Rigid.
   * Dönen işlev bekleyen vuruşları iptal eder (açılış erken kapanırsa).
   */
  splash: (beats: { at: number; kind: 'soft' | 'tick' | 'firm' }[]): (() => void) => {
    if (!enabled() || beats.length === 0) return noop;
    if (Platform.OS === 'android') {
      const ms = { soft: 14, tick: 7, firm: 26 } as const;
      const pattern: number[] = [];
      let t = 0;
      for (const b of beats) { pattern.push(Math.max(0, b.at - t), ms[b.kind]); t = b.at + ms[b.kind]; }
      Vibration.vibrate(pattern);
      return () => Vibration.cancel();
    }
    const timers = beats.map(b => setTimeout(() => {
      if (b.kind === 'tick') safe(Expo.selectionAsync());
      else safe(Expo.impactAsync(b.kind === 'soft' ? Expo.ImpactFeedbackStyle.Soft : Expo.ImpactFeedbackStyle.Rigid));
    }, b.at));
    return () => timers.forEach(clearTimeout);
  },
};
const noop = () => {};

/**
 * TİTREŞİM YOK — bilinçli sessizlik.
 *
 * Var olması, gözden kaçmış bir eksik ile KARAR verilmiş sessizliği ayırt etmek
 * için: kod okurken "burada neden haptik yok?" sorusuna cevap verir.
 */
export const noHaptic = () => {};
