import ExpoModulesCore
import WatchConnectivity

// WCSessionDelegate must be an NSObject — keep it separate from the Expo Module class
private class WatchSessionManager: NSObject, WCSessionDelegate {
  weak var module: ExpoWatchConnectivityModule?

  func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) { session.activate() }

  func sessionReachabilityDidChange(_ session: WCSession) {
    module?.sendEvent("onWatchEvent", [
      "type": "reachabilityChanged",
      "data": ["reachable": session.isReachable]
    ])
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    guard let type = message["type"] as? String,
          let data = message["data"] as? [String: Any] else { return }
    module?.sendEvent("onWatchEvent", ["type": type, "data": data])
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {}
}

public class ExpoWatchConnectivityModule: Module {
  private var session: WCSession?
  private let sessionManager = WatchSessionManager()

  public func definition() -> ModuleDefinition {
    Name("ExpoWatchConnectivity")

    Events("onWatchEvent")

    OnCreate {
      self.sessionManager.module = self
      if WCSession.isSupported() {
        self.session = WCSession.default
        self.session?.delegate = self.sessionManager
        self.session?.activate()
      }
    }

    AsyncFunction("isWatchSupported") { () -> Bool in
      WCSession.isSupported()
    }

    AsyncFunction("isWatchPaired") { () -> Bool in
      self.session?.isPaired ?? false
    }

    AsyncFunction("isWatchReachable") { () -> Bool in
      self.session?.isReachable ?? false
    }

    AsyncFunction("sendToWatch") { (data: [String: Any]) in
      guard let session = self.session, session.isReachable else {
        self.updateContextInternal(data: data)
        return
      }
      session.sendMessage(data, replyHandler: nil) { _ in }
      self.updateContextInternal(data: data)
    }

    AsyncFunction("updateApplicationContext") { (data: [String: Any]) in
      self.updateContextInternal(data: data)
    }
  }

  private func updateContextInternal(data: [String: Any]) {
    guard let session = session, session.activationState == .activated else { return }
    try? session.updateApplicationContext(data)
  }
}
