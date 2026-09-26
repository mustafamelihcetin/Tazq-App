import Foundation
import WatchConnectivity
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

struct WatchData: Codable {
  var habits: [WatchHabit]
  var streak: Int
  var bestStreak: Int
  var focusActive: Bool
  var focusElapsedSeconds: Int
  var focusTotalSeconds: Int
  var countdown: WatchCountdown?
  var habitsCompletedToday: Int
  var habitsTotal: Int
  var language: String
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
    if WCSession.isSupported() {
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

  func toggleFocus(durationMinutes: Int = 25) {
    if focusActive {
      stopFocusLocal()
      sendToPhone(type: "focusAction", data: ["action": "stop"])
    } else {
      startFocusLocal(durationMinutes: durationMinutes)
      sendToPhone(type: "focusAction", data: ["action": "start", "durationMinutes": durationMinutes])
    }
    WKInterfaceDevice.current().play(.click)
  }

  // MARK: - Local Focus Timer

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
      self.habits = data.habits
      self.streak = data.streak
      self.bestStreak = data.bestStreak
      self.focusTotalSeconds = data.focusTotalSeconds
      self.countdown = data.countdown
      self.habitsCompletedToday = data.habitsCompletedToday
      self.habitsTotal = data.habitsTotal
      self.language = data.language
      if data.focusActive && !self.focusActive {
        self.startFocusLocal(durationMinutes: data.focusTotalSeconds / 60)
        self.focusElapsedSeconds = data.focusElapsedSeconds
      } else if !data.focusActive && self.focusActive {
        self.stopFocusLocal()
      }
    }
  }
}
