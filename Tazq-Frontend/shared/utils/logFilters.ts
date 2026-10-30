/*
  KÜTÜPHANE UYARI SÜZGECİ — `_layout`ın İLK içe aktarımı olmalı.

  Susturma eskiden `_layout` gövdesindeydi; ama `import` satırları gövdeden ÖNCE çalışır.
  moti, yüklenirken react-native'in eski SafeAreaView'ını sardığı için uyarıyı daha süzgeç
  kurulmadan basıyordu. Altta beliren uyarı bildirimine (örn. alt sekmeye dokunurken)
  basılınca LogBox penceresi açılıyor, kendisi çizilemeyip ekranı SİYAH bırakıyordu
  (yalnız geliştirme sürümü; 2026-10-30 cihazda görüldü).
*/
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  'SafeAreaView has been deprecated', // moti/build/components/safe-area-view.js — bizim kod react-native-safe-area-context kullanıyor
  'Sending `onAnimatedValueUpdate` with no listeners registered',
]);
