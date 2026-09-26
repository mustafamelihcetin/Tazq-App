import SwiftUI
import WatchKit
import WatchConnectivity

@main
struct TazqWatchApp: App {
  @StateObject private var store = SessionStore()

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(store)
    }
  }
}
