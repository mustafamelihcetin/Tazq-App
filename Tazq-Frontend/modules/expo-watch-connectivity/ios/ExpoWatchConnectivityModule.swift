import Foundation
import WatchConnectivity

@objc(ExpoWatchConnectivity)
class ExpoWatchConnectivityModule: RCTEventEmitter, WCSessionDelegate {

  private var session: WCSession?
  private var hasListeners = false

  override init() {
    super.init()
    if WCSession.isSupported() {
      session = WCSession.default
      session?.delegate = self
      session?.activate()
    }
  }

  override static func requiresMainQueueSetup() -> Bool { true }

  override func supportedEvents() -> [String]! {
    return ["onWatchEvent"]
  }

  override func startObserving() { hasListeners = true }
  override func stopObserving() { hasListeners = false }

  private func emit(_ type: String, data: [String: Any]) {
    guard hasListeners else { return }
    sendEvent(withName: "onWatchEvent", body: ["type": type, "data": data])
  }

  // MARK: - JS-callable methods

  @objc func isWatchSupported(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(WCSession.isSupported())
  }

  @objc func isWatchPaired(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(session?.isPaired ?? false)
  }

  @objc func isWatchReachable(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(session?.isReachable ?? false)
  }

  @objc func sendToWatch(_ data: NSDictionary, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    guard let session = session, session.isReachable else {
      // Not reachable — fall back to application context
      updateContextInternal(data: data)
      resolve(nil)
      return
    }
    session.sendMessage(data as! [String: Any], replyHandler: nil) { error in
      // Ignore send errors silently — watch will sync via context
    }
    updateContextInternal(data: data)
    resolve(nil)
  }

  @objc func updateApplicationContext(_ data: NSDictionary, resolver resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    updateContextInternal(data: data)
    resolve(nil)
  }

  private func updateContextInternal(data: NSDictionary) {
    guard let session = session, session.activationState == .activated else { return }
    do {
      try session.updateApplicationContext(data as! [String: Any])
    } catch {
      // Silent — context update failures are non-critical
    }
  }

  // MARK: - WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    emit("reachabilityChanged", data: ["reachable": session.isReachable])
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    guard let type = message["type"] as? String,
          let data = message["data"] as? [String: Any] else { return }
    emit(type, data: data)
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    // Watch sent updated context — usually not used but handle gracefully
  }
}
