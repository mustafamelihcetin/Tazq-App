import SwiftUI

struct FocusView: View {
  @EnvironmentObject var store: SessionStore
  @State private var selectedMinutes = 25
  private let durations = [15, 25, 45, 60]
  private var tr: Bool { store.language == "tr" }

  private var remaining: Int {
    max(0, store.focusTotalSeconds - store.focusElapsedSeconds)
  }

  private var progressPct: Double {
    guard store.focusTotalSeconds > 0 else { return 0 }
    return Double(store.focusElapsedSeconds) / Double(store.focusTotalSeconds)
  }

  private var timeString: String {
    let m = remaining / 60
    let s = remaining % 60
    return String(format: "%02d:%02d", m, s)
  }

  var body: some View {
    VStack(spacing: 10) {
      // Circular timer
      ZStack {
        Circle()
          .stroke(Color.white.opacity(0.1), lineWidth: 6)
          .frame(width: 90, height: 90)

        Circle()
          .trim(from: 0, to: progressPct)
          .stroke(
            store.focusActive ? Color.orange : Color.blue,
            style: StrokeStyle(lineWidth: 6, lineCap: .round)
          )
          .rotationEffect(.degrees(-90))
          .frame(width: 90, height: 90)
          .animation(.linear(duration: 1), value: progressPct)

        VStack(spacing: 0) {
          if store.focusActive {
            Text(timeString)
              .font(.system(size: 20, weight: .black, design: .monospaced))
              .foregroundColor(.white)
          } else {
            Text("🎯")
              .font(.system(size: 28))
          }
        }
      }

      // Duration picker (only when not active)
      if !store.focusActive {
        HStack(spacing: 6) {
          ForEach(durations, id: \.self) { min in
            Button {
              selectedMinutes = min
            } label: {
              Text("\(min)")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(selectedMinutes == min ? .black : .white)
                .padding(.horizontal, 7)
                .padding(.vertical, 4)
                .background(
                  Capsule().fill(selectedMinutes == min ? Color.blue : Color.white.opacity(0.12))
                )
            }
            .buttonStyle(.plain)
          }
        }
      } else {
        Text(tr ? "Odaklan 🔥" : "Stay focused 🔥")
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(.orange)
      }

      // Start / Stop button
      Button {
        store.toggleFocus(durationMinutes: selectedMinutes)
      } label: {
        HStack(spacing: 6) {
          Image(systemName: store.focusActive ? "stop.fill" : "play.fill")
            .font(.system(size: 13))
          Text(store.focusActive
               ? (tr ? "Durdur" : "Stop")
               : (tr ? "Başlat" : "Start"))
            .font(.system(size: 13, weight: .bold))
        }
        .foregroundColor(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 9)
        .background(
          RoundedRectangle(cornerRadius: 22)
            .fill(store.focusActive ? Color.red.opacity(0.8) : Color.blue)
        )
      }
      .buttonStyle(.plain)
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 8)
  }
}
