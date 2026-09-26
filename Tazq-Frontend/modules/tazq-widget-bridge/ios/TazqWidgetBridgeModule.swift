import ExpoModulesCore
import WidgetKit
import WatchConnectivity

// Telefon (React Native) ile Ana Ekran Widget'ı ve Apple Watch arasındaki tek
// veri köprüsü. Widget App Group UserDefaults'tan okur; Watch WatchConnectivity
// üzerinden updateApplicationContext ile alır (telefon menzilde olmasa bile
// son bağlamı teslim eder — sendMessage aksine).
private let appGroupID = "group.com.tazqapp.tazq"

public class TazqWidgetBridgeModule: Module {
  private var sessionDelegate: WatchSessionDelegate?

  public func definition() -> ModuleDefinition {
    Name("TazqWidgetBridge")

    // Watch'tan gelen tek eylem: alışkanlık tamamlama. `data` = {"habitId": "123"}.
    // Odak başlat/durdur kasıtlı olarak buraya dahil değil — telefondaki odak
    // akışı commit/claim adımlarıyla durum makinesi; Watch'tan körlemesine
    // yazmak yarım/çift oturum riski taşır. Bu yüzden Watch'taki odak ekranı
    // şimdilik yalnız telefonun durumunu YANSITIYOR, yazmıyor.
    Events("onWatchAction")

    OnCreate {
      if WCSession.isSupported() {
        let delegate = WatchSessionDelegate { [weak self] dict in
          self?.sendEvent("onWatchAction", dict)
        }
        self.sessionDelegate = delegate
        WCSession.default.delegate = delegate
        WCSession.default.activate()
      }
    }

    // `data`: widget/watch'ın okuduğu düz anahtar-değer sözlüğü (streak, habits vb.)
    // JSON string olarak alınır — Expo Modules'ın [String: Any] dönüştürmesi
    // Watch tarafındaki JSONDecoder ile aynı şemayı zorlamak yerine burada
    // tek noktadan kontrol edilsin diye.
    AsyncFunction("updateSharedData") { (json: String) in
      guard let defaults = UserDefaults(suiteName: appGroupID),
            let data = json.data(using: .utf8),
            let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
      else { return }

      for (key, value) in dict {
        defaults.set(value, forKey: key)
      }

      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }

      if WCSession.isSupported() && WCSession.default.activationState == .activated {
        try? WCSession.default.updateApplicationContext(dict)
      }
    }
  }
}

// WCSessionDelegate sınıf gerektirir (protokol Module'e doğrudan uygulanamaz);
// telefon tarafında şimdilik yalnız aktivasyonu tamamlıyoruz — Watch'tan gelen
// mesajlar (alışkanlık tamamlama vb.) ayrı bir iterasyonda ele alınacak.
private class WatchSessionDelegate: NSObject, WCSessionDelegate {
  private let onMessage: ([String: Any]) -> Void

  init(onMessage: @escaping ([String: Any]) -> Void) {
    self.onMessage = onMessage
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) { session.activate() }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    onMessage(message)
  }
}
