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
  let tr: Bool
}

struct TazqProvider: TimelineProvider {
  func placeholder(in context: Context) -> TazqEntry {
    TazqEntry(date: .now, streak: 7, habitsCompleted: 3, habitsTotal: 5, tr: true)
  }

  func getSnapshot(in context: Context, completion: @escaping (TazqEntry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TazqEntry>) -> Void) {
    // Telefon her değişiklikte reloadAllTimelines() çağırıyor; burada yine de
    // 30 dakikalık bir yedek yenileme var — uygulama arka plandayken saat
    // gece yarısını geçerse "bugün" widget'ta da tazelensin diye.
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
      tr: (d?.string(forKey: "language") ?? "tr") == "tr"
    )
  }
}

private let bg = Color(red: 0x10 / 255, green: 0x13 / 255, blue: 0x1A / 255) // uygulamanın koyu zemini
private let streakOrange = Color(red: 0xFB / 255, green: 0x92 / 255, blue: 0x3C / 255)
private let habitGreen = Color(red: 0x22 / 255, green: 0xC5 / 255, blue: 0x5E / 255)

struct TazqWidgetView: View {
  let entry: TazqEntry
  @Environment(\.widgetFamily) var family

  var pct: Double {
    guard entry.habitsTotal > 0 else { return 0 }
    return Double(entry.habitsCompleted) / Double(entry.habitsTotal)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text("TAZQ")
          .font(.system(size: 12, weight: .black))
          .foregroundColor(.white.opacity(0.6))
        Spacer()
        HStack(spacing: 3) {
          Text("🔥").font(.system(size: 12))
          Text("\(entry.streak)")
            .font(.system(size: 13, weight: .bold))
            .foregroundColor(streakOrange)
        }
      }

      Spacer(minLength: 0)

      if entry.habitsTotal > 0 {
        Text("\(entry.habitsCompleted)/\(entry.habitsTotal)")
          .font(.system(size: 28, weight: .black))
          .foregroundColor(.white)
        Text(entry.tr ? "bugünkü alışkanlık" : "habits today")
          .font(.system(size: 11, weight: .semibold))
          .foregroundColor(.white.opacity(0.5))

        GeometryReader { geo in
          ZStack(alignment: .leading) {
            RoundedRectangle(cornerRadius: 3)
              .fill(Color.white.opacity(0.12))
            RoundedRectangle(cornerRadius: 3)
              .fill(habitGreen)
              .frame(width: geo.size.width * pct)
          }
        }
        .frame(height: 6)
      } else {
        Text(entry.tr ? "Telefonda bir alışkanlık ekle" : "Add a habit in the app")
          .font(.system(size: 12, weight: .medium))
          .foregroundColor(.white.opacity(0.6))
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .containerBackground(bg, for: .widget)
  }
}

struct TazqWidget: Widget {
  let kind = "TazqWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: TazqProvider()) { entry in
      TazqWidgetView(entry: entry)
    }
    .configurationDisplayName("TAZQ")
    .description("Bugünkü alışkanlık ilerlemen ve serin.")
    .supportedFamilies([.systemSmall])
  }
}

#Preview(as: .systemSmall) {
  TazqWidget()
} timeline: {
  TazqEntry(date: .now, streak: 12, habitsCompleted: 3, habitsTotal: 5, tr: true)
}
