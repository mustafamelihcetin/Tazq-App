import SwiftUI

struct HabitsView: View {
  @EnvironmentObject var store: SessionStore
  private var tr: Bool { store.language == "tr" }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 6) {
        // Header
        HStack {
          Text(tr ? "Bugün" : "Today")
            .font(.system(size: 14, weight: .black))
            .foregroundColor(.white)
          Spacer()
          Text("\(store.habitsCompletedToday)/\(store.habitsTotal)")
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(.green)
        }
        .padding(.bottom, 4)

        // Progress bar
        if store.habitsTotal > 0 {
          let pct = Double(store.habitsCompletedToday) / Double(store.habitsTotal)
          GeometryReader { geo in
            ZStack(alignment: .leading) {
              RoundedRectangle(cornerRadius: 3)
                .fill(Color.white.opacity(0.12))
                .frame(height: 5)
              RoundedRectangle(cornerRadius: 3)
                .fill(Color.green)
                .frame(width: geo.size.width * pct, height: 5)
            }
          }
          .frame(height: 5)
          .padding(.bottom, 6)
        }

        if store.habits.isEmpty {
          Text(tr ? "Telefondaki alışkanlıklar burada görünür" : "Habits from the app appear here")
            .font(.system(size: 11))
            .foregroundColor(.secondary)
            .multilineTextAlignment(.center)
            .padding(.top, 12)
        } else {
          ForEach(store.habits) { habit in
            HabitRow(habit: habit)
          }
        }
      }
      .padding(.horizontal, 8)
      .padding(.vertical, 10)
    }
  }
}

struct HabitRow: View {
  @EnvironmentObject var store: SessionStore
  let habit: WatchHabit
  @State private var bouncing = false

  var accentColor: Color {
    Color(hex: habit.color) ?? .blue
  }

  var body: some View {
    Button {
      guard !habit.completedToday else { return }
      withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) { bouncing = true }
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { bouncing = false }
      store.completeHabit(habit)
    } label: {
      HStack(spacing: 8) {
        Text(habit.emoji)
          .font(.system(size: 18))
          .scaleEffect(bouncing ? 1.3 : 1.0)

        Text(habit.name)
          .font(.system(size: 13, weight: .semibold))
          .foregroundColor(habit.completedToday ? .secondary : .white)
          .lineLimit(1)

        Spacer()

        Image(systemName: habit.completedToday ? "checkmark.circle.fill" : "circle")
          .foregroundColor(habit.completedToday ? .green : Color.white.opacity(0.3))
          .font(.system(size: 16))
      }
      .padding(.horizontal, 10)
      .padding(.vertical, 8)
      .background(
        RoundedRectangle(cornerRadius: 10)
          .fill(habit.completedToday ? Color.green.opacity(0.12) : accentColor.opacity(0.15))
          .overlay(
            RoundedRectangle(cornerRadius: 10)
              .stroke(habit.completedToday ? Color.green.opacity(0.3) : accentColor.opacity(0.25), lineWidth: 1)
          )
      )
    }
    .buttonStyle(.plain)
    .animation(.spring(), value: habit.completedToday)
  }
}

extension Color {
  init?(hex: String) {
    let h = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    var int: UInt64 = 0
    guard Scanner(string: h).scanHexInt64(&int), h.count == 6 || h.count == 8 else { return nil }
    let a, r, g, b: UInt64
    switch h.count {
    case 6: (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
    case 8: (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
    default: return nil
    }
    self.init(.sRGB, red: Double(r)/255, green: Double(g)/255, blue: Double(b)/255, opacity: Double(a)/255)
  }
}
