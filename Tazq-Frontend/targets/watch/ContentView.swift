import SwiftUI

struct ContentView: View {
  @EnvironmentObject var store: SessionStore
  @State private var selectedTab = 0

  var body: some View {
    TabView(selection: $selectedTab) {
      HabitsView()
        .tag(0)
        .tabItem { Label("", systemImage: "checkmark.circle") }

      FocusView()
        .tag(1)
        .tabItem { Label("", systemImage: "timer") }

      StatsView()
        .tag(2)
        .tabItem { Label("", systemImage: "chart.bar") }
    }
    .tabViewStyle(.page)
  }
}
