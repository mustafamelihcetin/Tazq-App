import Foundation
import WatchConnectivity
import WatchKit
import Combine

struct WatchHabit: Codable, Identifiable, Equatable {
  let id: String
  let name: String
  let emoji: String
  let color: String
  var completedToday: Bool
}

struct WatchCountdown: Codable {
  let name: String
  let daysLeft: Int
  let type: String
  let color: String
}

/*
  ÇOĞU ALAN OPSİYONEL — bilerek.

  Bu struct'ın ilk hâlinde hepsi ZORUNLUYDU; JSONDecoder ZORUNLU bir alan eksikse
  TÜM decode'u reddediyor, tek bir alan gönderilmese bile. Opsiyonel yapmak,
  telefonun göndermediği alanları (focus alanları hâlâ gönderilmiyor — bkz.
  widgetBridge.ts'teki "BİLEREK dinlenmiyor" notu ve FocusView.swift'in salt-izleme
  notu) mevcut değerinde bırakıyor; TEK bir eksik/yeni alan yüzünden gelen HİÇBİR
  güncelleme reddedilmiyor. `habits`/`bestStreak` alanları 2026-09'da widgetBridge.ts'e
  eklendi — bu struct zaten opsiyonel olduğu için ekleme sorunsuzdu, adı/alt-alan
  adları karşı taraftaki struct'la birebir eşleşmesi yeterliydi.
*/
struct WatchData: Codable {
  var habits: [WatchHabit]?
  var streak: Int?
  var bestStreak: Int?
  var focusActive: Bool?
  var focusElapsedSeconds: Int?
  var focusTotalSeconds: Int?
  var countdown: WatchCountdown?
  var habitsCompletedToday: Int?
  var habitsTotal: Int?
  var language: String?
}

class SessionStore: NSObject, ObservableObject, WCSessionDelegate {
  @Published var habits: [WatchHabit] = []
  @Published var streak: Int = 0
  @Published var bestStreak: Int = 0
  @Published var focusActive: Bool = false
  @Published var focusElapsedSeconds: Int = 0
  @Published var focusTotalSeconds: Int = 25 * 60
  @Published var countdown: WatchCountdown? = nil
  @Published var habitsCompletedToday: Int = 0
  @Published var habitsTotal: Int = 0
  @Published var language: String = "tr"
  @Published var isPhoneReachable: Bool = false

  private var focusTimer: Timer?

  override init() {
    super.init()
    // Ana kuyruğa elle atlama — telefon tarafındaki TazqWidgetBridgeModule.swift'te
    // aynı gerekçeyle uygulandı: WCSession bir singleton, delegate/activate() çağrılarını
    // Apple'ın belgelerindeki örnekler hep ana kuyruktan yapıyor; `init()`'in hangi
    // kuyrukta çalıştığı (SwiftUI @StateObject başlatma sırası) garanti değil.
    DispatchQueue.main.async { [weak self] in
      guard WCSession.isSupported() else { return }
      WCSession.default.delegate = self
      WCSession.default.activate()
    }
  }

  // MARK: - Public Actions (sent to iPhone)

  func completeHabit(_ habit: WatchHabit) {
    guard let idx = habits.firstIndex(where: { $0.id == habit.id }) else { return }
    habits[idx].completedToday = true
    habitsCompletedToday = habits.filter { $0.completedToday }.count

    sendToPhone(type: "habitCompleted", data: ["habitId": habit.id])
    WKInterfaceDevice.current().play(.success)
  }

  // MARK: - Local Focus Timer (yalnız telefondan gelen durumu YANSITMAK için, bkz. FocusView.swift)

  private func startFocusLocal(durationMinutes: Int) {
    focusActive = true
    focusTotalSeconds = durationMinutes * 60
    focusElapsedSeconds = 0
    focusTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      guard let self = self else { return }
      self.focusElapsedSeconds += 1
      if self.focusElapsedSeconds >= self.focusTotalSeconds {
        self.stopFocusLocal()
        WKInterfaceDevice.current().play(.notification)
      }
    }
  }

  private func stopFocusLocal() {
    focusActive = false
    focusTimer?.invalidate()
    focusTimer = nil
  }

  // MARK: - WatchConnectivity → Phone

  private func sendToPhone(type: String, data: [String: Any]) {
    guard WCSession.default.isReachable else { return }
    WCSession.default.sendMessage(["type": type, "data": data], replyHandler: nil, errorHandler: nil)
  }

  // MARK: - WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    DispatchQueue.main.async { self.isPhoneReachable = session.isReachable }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    DispatchQueue.main.async { self.isPhoneReachable = session.isReachable }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    applyData(message)
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    applyData(applicationContext)
  }

  private func applyData(_ dict: [String: Any]) {
    guard let jsonData = try? JSONSerialization.data(withJSONObject: dict),
          let data = try? JSONDecoder().decode(WatchData.self, from: jsonData) else { return }
    DispatchQueue.main.async {
      // Gelmeyen alan mevcut değerde KALIR, sıfırlanmaz — telefon şu an habit
      // listesi/odak durumu göndermiyor diye Watch'ın elindeki son bilgi silinmesin.
      if let habits = data.habits { self.habits = habits }
      if let streak = data.streak { self.streak = streak }
      if let bestStreak = data.bestStreak { self.bestStreak = bestStreak }
      if let focusTotalSeconds = data.focusTotalSeconds { self.focusTotalSeconds = focusTotalSeconds }
      self.countdown = data.countdown
      if let habitsCompletedToday = data.habitsCompletedToday { self.habitsCompletedToday = habitsCompletedToday }
      if let habitsTotal = data.habitsTotal { self.habitsTotal = habitsTotal }
      if let language = data.language { self.language = language }
      if let focusActive = data.focusActive {
        if focusActive && !self.focusActive {
          self.startFocusLocal(durationMinutes: (data.focusTotalSeconds ?? self.focusTotalSeconds) / 60)
          self.focusElapsedSeconds = data.focusElapsedSeconds ?? 0
        } else if !focusActive && self.focusActive {
          self.stopFocusLocal()
        }
      }
    }
  }
}
