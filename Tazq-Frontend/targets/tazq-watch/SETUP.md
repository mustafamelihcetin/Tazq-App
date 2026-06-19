# Tazq Apple Watch App — Kurulum Kılavuzu

## Gereksinimler
- macOS + Xcode 15+
- Apple Developer hesabı (App Group için)
- EAS Build veya `expo prebuild`

## EAS Build ile (Önerilen)

Config plugin otomatik çalışır:
```bash
eas build --platform ios --profile development
```

## Manuel Kurulum (Xcode'da)

### 1. Prebuild
```bash
cd Tazq-Frontend
npx expo prebuild --platform ios
```

### 2. Xcode'da Watch App Target Ekle
- `ios/Tazq.xcworkspace` aç
- File → New → Target → watchOS → Watch App
- Product Name: **TazqWatch**
- Bundle ID: `com.tazqapp.tazq.watchkitapp`
- SwiftUI seç, watchOS 9.0 minimum

### 3. Complication Widget Target
- File → New → Target → watchOS → Widget Extension
- Product Name: **TazqComplication**
- Bundle ID: `com.tazqapp.tazq.watchkitapp.complication`

### 4. Swift Dosyalarını Kopyala
`targets/tazq-watch/*.swift` dosyalarını Watch target'a sürükle:
- TazqWatchApp, ContentView, SessionStore, HabitsView, FocusView, StatsView → **TazqWatch**
- TazqComplication → **TazqComplication**

### 5. App Group Ekle
Her iki target için de (iPhone app, Watch app, Complication):
- Signing & Capabilities → + Capability → App Groups
- `group.com.tazqapp.tazq` ekle

### 6. WatchConnectivity Framework
- iPhone target → Build Phases → Link Binary With Libraries
- `WatchConnectivity.framework` ekle

### 7. Native Module Bridge
`modules/expo-watch-connectivity/ios/` klasöründeki dosyaları iPhone target'a ekle:
- `ExpoWatchConnectivityModule.swift`
- `ExpoWatchConnectivityModule.m`

## Watch App Özellikleri

| Ekran | İçerik |
|-------|---------|
| Alışkanlıklar | Bugünkü liste, bilet tık ile tamamla |
| Odak | Timer başlat/durdur, 15/25/45/60 dk seçim |
| İstatistik | Streak, sınav/tez/mülakat geri sayım |

## Complication Türleri

| Tür | İçerik |
|-----|---------|
| Circular | 🔥 Streak sayısı |
| Rectangular | Alışkanlık ilerleme barı |
| Corner | Streak sayısı |
| Inline | Özet metin |

## Veri Akışı

```
iPhone (React Native)
  └─ syncToWatch() → WatchConnectivity → Apple Watch
                                             └─ SessionStore (SwiftUI)
                                                └─ HabitsView / FocusView / StatsView

Apple Watch (kullanıcı etkileşimi)
  └─ sendToPhone() → WatchConnectivity → iPhone
                                            └─ initWatchBridge.onHabitCompleted()
                                            └─ initWatchBridge.onFocusStart/Stop()
```
