import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * KLAVYENİN KAPLADIĞI YÜKSEKLİK — alta yapışık yüzeyleri onun üstüne çıkarmak için.
 *
 * NEDEN `KeyboardAvoidingView` DEĞİL: alt sayfalar (bottom sheet) `Modal` içinde
 * yaşıyor ve `Modal` AYRI bir pencere açıyor. Ebeveyn ekranın `KeyboardAvoidingView`i
 * o pencereye ulaşmıyor — koruma varmış gibi görünüp çalışmıyor. Sayfanın kendi
 * yüksekliğini bilip `marginBottom` uygulaması bu yüzden tek güvenilir yol.
 *
 * NEDEN HOOK: aynı dinleyici blok blok ÜÇ dosyada kopyalanmıştı (QuickDraftModal,
 * TaskFormModal, settings) ve dördüncüsü gerektiğinde dördüncü kopya yazılacaktı.
 * Kopyaların hepsi bugün aynı; yarın biri `keyboardWillChangeFrame` eklerse ötekiler
 * eskir ve fark yalnız o ekranda ortaya çıkar.
 *
 * PLATFORM FARKI:
 *  · iOS   — `will` olayları klavye ANIMASYONUNDAN ÖNCE gelir; sayfa klavyeyle
 *            birlikte hareket eder, arkadan yetişmez.
 *  · Android — `will` olayları YOKTUR, `did` kullanılır. Ayrıca uygulama
 *            `softwareKeyboardLayoutMode: "resize"` ile çalıştığı için (bkz. app.json)
 *            pencere zaten küçülür; yükseklik uygulamak İKİNCİ kez itmek olur.
 *            Bu yüzden çağıran taraf değeri genelde yalnız iOS'ta kullanır.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
