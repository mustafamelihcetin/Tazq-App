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
      /*
        ANA KUYRUĞA ELLE ATLA — `OnCreate`'in hangi kuyrukta çalıştığı Expo Modules
        sürümüne göre değişebilir; `WCSession.default` bir singleton ve delegate/
        activate() çağrılarını her zaman ana kuyrukta yapmak Apple'ın belgelerindeki
        WatchConnectivity örnekleriyle tutarlı. Yanlış kuyrukta yapılan bir UIKit/
        WatchConnectivity çağrısı sessizce çalışabilir YA DA açılışta çökebilir —
        splash'teki çökme raporundan beri bu ihtimal netleşmedi, ucuz ve zararsız
        bir önlem olarak burada kapatılıyor.
      */
      DispatchQueue.main.async { [weak self] in
        guard WCSession.isSupported() else { return }
        let delegate = WatchSessionDelegate { [weak self] dict in
          // `didReceiveMessage` sistem tarafından ARKA PLAN kuyruğunda çağrılabilir
          // (Apple belgeleri) — `sendEvent` de aynı gerekçeyle ana kuyruğa atlanıyor.
          DispatchQueue.main.async { self?.sendEvent("onWatchAction", dict) }
        }
        self?.sessionDelegate = delegate
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

      /*
        `null` alanlar (ör. aktif mod kalmayınca countdownLabel) JSONSerialization'da
        NSNull olarak gelir. `UserDefaults.set(NSNull(), forKey:)` GEÇERLİ bir
        property-list tipi değildir ve SESSİZCE başarısız olur — eski değer silinmeden
        kalır. Sonuç: kullanıcı son aktif modunu kapatsa bile widget eski geri sayımı
        göstermeye devam ederdi. `removeObject` ile açıkça temizleniyor.
      */
      for (key, value) in dict {
        if value is NSNull {
          defaults.removeObject(forKey: key)
        } else {
          defaults.set(value, forKey: key)
        }
      }

      /*
        WidgetCenter/WCSession ANA KUYRUKTA — `OnCreate`teki notla aynı gerekçe.
        `AsyncFunction` gövdesi bir arka plan kuyruğunda çalışır; bu iki API de
        Apple'ın kendi örneklerinde hep ana kuyruktan çağrılır.
      */
      DispatchQueue.main.async {
        if #available(iOS 14.0, *) {
          WidgetCenter.shared.reloadAllTimelines()
        }

        /*
          Watch'a giden `dict` AYNI kaynak — NSNull hâlâ içinde. WCSession de property
          list dışı tipleri kabul etmiyor; en az bir alan `null` olduğunda (ör. aktif
          mod yokken, ki bu SIK bir durum) `updateApplicationContext` `try?` içinde
          SESSİZCE başarısız olur ve o turdaki TÜM Watch güncellemesi kaybolurdu —
          yalnız o bir alan değil. NSNull anahtarları göndermeden önce ayıklanıyor.
        */
        if WCSession.isSupported() && WCSession.default.activationState == .activated {
          let watchSafeDict = dict.filter { !($0.value is NSNull) }
          try? WCSession.default.updateApplicationContext(watchSafeDict)
        }
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
