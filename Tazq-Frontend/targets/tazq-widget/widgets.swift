import WidgetKit
import SwiftUI

// Telefon uygulamasıyla AYNI App Group'tan okur — bkz.
// modules/tazq-widget-bridge/ios/TazqWidgetBridgeModule.swift (yazan taraf).
private let appGroupID = "group.com.tazqapp.tazq"

struct TazqEntry: TimelineEntry {
  let date: Date
  let streak: Int
  let habitsCompleted: Int
  let habitsTotal: Int
  let tasksCompleted: Int
  let tasksTotal: Int
  let tr: Bool
  let countdownLabel: String?
  let countdownDays: Int?
  let countdownColorHex: String?
  let countdownTextHex: String?
  let countdownEmoji: String?
}

struct TazqProvider: TimelineProvider {
  func placeholder(in context: Context) -> TazqEntry {
    TazqEntry(date: .now, streak: 7, habitsCompleted: 3, habitsTotal: 5, tasksCompleted: 2, tasksTotal: 6, tr: true,
               countdownLabel: "YKS 2027", countdownDays: 42, countdownColorHex: "#0A84FF", countdownTextHex: "#0A84FF", countdownEmoji: "🎯")
  }

  func getSnapshot(in context: Context, completion: @escaping (TazqEntry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TazqEntry>) -> Void) {
    // Telefon her değişiklikte reloadAllTimelines() çağırıyor; burada yine de
    // 30 dakikalık bir yedek yenileme var — uygulama arka plandayken saat
    // gece yarısını geçerse ya da bir geri sayım bir gün azalırsa widget'ta
    // da tazelensin diye.
    let next = Calendar.current.date(byAdding: .minute, value: 30, to: .now) ?? .now
    completion(Timeline(entries: [loadEntry()], policy: .after(next)))
  }

  private func loadEntry() -> TazqEntry {
    let d = UserDefaults(suiteName: appGroupID)
    return TazqEntry(
      date: .now,
      streak: d?.integer(forKey: "streak") ?? 0,
      habitsCompleted: d?.integer(forKey: "habitsCompletedToday") ?? 0,
      habitsTotal: d?.integer(forKey: "habitsTotal") ?? 0,
      tasksCompleted: d?.integer(forKey: "tasksCompletedToday") ?? 0,
      tasksTotal: d?.integer(forKey: "tasksTotal") ?? 0,
      tr: (d?.string(forKey: "language") ?? "tr") == "tr",
      countdownLabel: d?.string(forKey: "countdownLabel"),
      countdownDays: d?.object(forKey: "countdownDays") as? Int,
      countdownColorHex: d?.string(forKey: "countdownColor"),
      countdownTextHex: d?.string(forKey: "countdownTextColor"),
      countdownEmoji: d?.string(forKey: "countdownEmoji")
    )
  }
}

// MARK: - Ortak stil

// Uygulamanın koyu zemini (bkz. shared/constants/Colors.ts karanlık tema arka planı).
private let bg = Color(red: 0x10 / 255, green: 0x13 / 255, blue: 0x1A / 255)
private let streakOrange = Color(red: 0xFB / 255, green: 0x92 / 255, blue: 0x3C / 255) // dark.streak
private let habitGreen = Color(red: 0x22 / 255, green: 0xC5 / 255, blue: 0x5E / 255)
private let taskBlue = Color(red: 0x0A / 255, green: 0x84 / 255, blue: 0xFF / 255) // dark.primary

private extension Color {
  init(hexOrNil: String?) {
    guard let hex = hexOrNil else { self = .white; return }
    let h = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    var int: UInt64 = 0
    guard Scanner(string: h).scanHexInt64(&int), h.count == 6 else { self = .white; return }
    self.init(.sRGB, red: Double((int >> 16) & 0xFF) / 255, green: Double((int >> 8) & 0xFF) / 255, blue: Double(int & 0xFF) / 255, opacity: 1)
  }
}

private struct StreakBadge: View {
  let streak: Int
  let tr: Bool
  var body: some View {
    VStack(spacing: 0) {
      Text("🔥").font(.system(size: 11))
      Text("\(streak)")
        .font(.system(size: 13, weight: .black))
        .foregroundColor(streakOrange)
      Text(tr ? "gün" : "day")
        .font(.system(size: 8, weight: .semibold))
        .foregroundColor(.white.opacity(0.4))
    }
  }
}

private struct ProgressRow: View {
  let label: String
  let done: Int
  let total: Int
  let color: Color
  var pct: Double { total > 0 ? Double(done) / Double(total) : 0 }
  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack {
        Text(label)
          .font(.system(size: 10, weight: .semibold))
          .foregroundColor(.white.opacity(0.6))
        Spacer()
        Text("\(done)/\(total)")
          .font(.system(size: 11, weight: .bold))
          .foregroundColor(.white)
      }
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          RoundedRectangle(cornerRadius: 2.5)
            .fill(Color.white.opacity(0.12))
          if total > 0 {
            RoundedRectangle(cornerRadius: 2.5)
              .fill(color)
              .frame(width: geo.size.width * pct)
          }
        }
      }
      .frame(height: 5)
    }
  }
}

// MARK: - Widget 1: Bugün (görev + alışkanlık + seri)

struct TazqTodayView: View {
  let entry: TazqEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Text("TAZQ")
          .font(.system(size: 12, weight: .black))
          .foregroundColor(.white.opacity(0.6))
        Spacer()
        StreakBadge(streak: entry.streak, tr: entry.tr)
      }

      Spacer(minLength: 0)

      if entry.tasksTotal > 0 || entry.habitsTotal > 0 {
        if entry.tasksTotal > 0 {
          ProgressRow(label: entry.tr ? "Görevler" : "Tasks", done: entry.tasksCompleted, total: entry.tasksTotal, color: taskBlue)
        }
        if entry.habitsTotal > 0 {
          ProgressRow(label: entry.tr ? "Alışkanlıklar" : "Habits", done: entry.habitsCompleted, total: entry.habitsTotal, color: habitGreen)
        }
      } else {
        Text(entry.tr ? "Bugün için bir şey yok" : "Nothing due today")
          .font(.system(size: 12, weight: .medium))
          .foregroundColor(.white.opacity(0.6))
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .containerBackground(bg, for: .widget)
  }
}

struct TazqTodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TazqTodayWidget", provider: TazqProvider()) { entry in
      TazqTodayView(entry: entry)
    }
    .configurationDisplayName("TAZQ — Bugün")
    .description("Bugünkü görev ve alışkanlık ilerlemen, serin.")
    .supportedFamilies([.systemSmall])
  }
}

// MARK: - Widget 2: Geri Sayım (aktif dönemin hedef tarihi)

struct TazqCountdownView: View {
  let entry: TazqEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Text("TAZQ")
          .font(.system(size: 12, weight: .black))
          .foregroundColor(.white.opacity(0.5))
        Spacer()
        if let emoji = entry.countdownEmoji { Text(emoji).font(.system(size: 14)) }
      }

      Spacer(minLength: 0)

      if let days = entry.countdownDays, let label = entry.countdownLabel {
        Text("\(days)")
          .font(.system(size: 34, weight: .black))
          .foregroundColor(Color(hexOrNil: entry.countdownTextHex))
        Text(entry.tr ? "gün kaldı" : "days left")
          .font(.system(size: 9, weight: .bold))
          .foregroundColor(Color(hexOrNil: entry.countdownTextHex).opacity(0.7))
          .textCase(.uppercase)
        Text(label)
          .font(.system(size: 11, weight: .semibold))
          .foregroundColor(.white.opacity(0.7))
          .lineLimit(1)
      } else {
        Text(entry.tr ? "Aktif bir dönemin yok" : "No active period")
          .font(.system(size: 12, weight: .medium))
          .foregroundColor(.white.opacity(0.6))
        Text(entry.tr ? "Uygulamadan bir mod başlat" : "Start a mode in the app")
          .font(.system(size: 10))
          .foregroundColor(.white.opacity(0.4))
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .containerBackground(bg, for: .widget)
  }
}

struct TazqCountdownWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TazqCountdownWidget", provider: TazqProvider()) { entry in
      TazqCountdownView(entry: entry)
    }
    .configurationDisplayName("TAZQ — Geri Sayım")
    .description("En yakın hedefine (sınav, tez, mülakat...) kalan gün.")
    .supportedFamilies([.systemSmall])
  }
}

#Preview("Bugün", as: .systemSmall) {
  TazqTodayWidget()
} timeline: {
  TazqEntry(date: .now, streak: 12, habitsCompleted: 3, habitsTotal: 5, tasksCompleted: 2, tasksTotal: 6, tr: true,
             countdownLabel: nil, countdownDays: nil, countdownColorHex: nil, countdownTextHex: nil, countdownEmoji: nil)
}

#Preview("Geri Sayım", as: .systemSmall) {
  TazqCountdownWidget()
} timeline: {
  TazqEntry(date: .now, streak: 12, habitsCompleted: 3, habitsTotal: 5, tasksCompleted: 2, tasksTotal: 6, tr: true,
             countdownLabel: "YKS 2027", countdownDays: 42, countdownColorHex: "#0A84FF", countdownTextHex: "#0A84FF", countdownEmoji: "🎯")
}
