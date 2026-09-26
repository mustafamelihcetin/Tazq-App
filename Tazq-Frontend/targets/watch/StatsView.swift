import SwiftUI

struct StatsView: View {
  @EnvironmentObject var store: SessionStore
  private var tr: Bool { store.language == "tr" }

  var body: some View {
    ScrollView {
      VStack(spacing: 10) {
        // Streak card
        VStack(spacing: 4) {
          Text("🔥")
            .font(.system(size: 28))
          Text("\(store.streak)")
            .font(.system(size: 36, weight: .black))
            .foregroundColor(.orange)
          Text(tr ? "günlük seri" : "day streak")
            .font(.system(size: 10, weight: .semibold))
            .foregroundColor(.secondary)
          if store.bestStreak > 0 {
            Text(tr ? "En iyi: \(store.bestStreak)" : "Best: \(store.bestStreak)")
              .font(.system(size: 10))
              .foregroundColor(.secondary)
          }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(
          RoundedRectangle(cornerRadius: 14)
            .fill(Color.orange.opacity(0.12))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.orange.opacity(0.25), lineWidth: 1))
        )

        // Countdown card (if active)
        if let cd = store.countdown {
          let color = countdownColor(cd)
          VStack(spacing: 4) {
            Text(countdownEmoji(cd))
              .font(.system(size: 18))
            Text("\(cd.daysLeft)")
              .font(.system(size: 32, weight: .black))
              .foregroundColor(color)
            Text(tr ? "gün kaldı" : "days left")
              .font(.system(size: 9, weight: .bold))
              .foregroundColor(color.opacity(0.7))
              .textCase(.uppercase)
              .kerning(0.5)
            Text(cd.name)
              .font(.system(size: 10, weight: .semibold))
              .foregroundColor(.secondary)
              .lineLimit(1)
          }
          .frame(maxWidth: .infinity)
          .padding(.vertical, 10)
          .background(
            RoundedRectangle(cornerRadius: 14)
              .fill(color.opacity(0.10))
              .overlay(RoundedRectangle(cornerRadius: 14).stroke(color.opacity(0.22), lineWidth: 1))
          )
        }
      }
      .padding(.horizontal, 8)
      .padding(.vertical, 10)
    }
  }

  private func countdownColor(_ cd: WatchCountdown) -> Color {
    if cd.daysLeft <= 7 { return .red }
    if cd.daysLeft <= 30 { return .yellow }
    switch cd.type {
    case "tez": return Color(hex: "#8B5CF6") ?? .purple
    case "mulakat": return Color(hex: "#10B981") ?? .green
    default: return .blue
    }
  }

  private func countdownEmoji(_ cd: WatchCountdown) -> String {
    switch cd.type {
    case "tez": return "📝"
    case "mulakat": return "💼"
    default: return "🎯"
    }
  }
}
