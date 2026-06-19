import WidgetKit
import SwiftUI

// Shared data read from App Group UserDefaults
private let appGroupID = "group.com.tazqapp.tazq"

struct TazqEntry: TimelineEntry {
  let date: Date
  let streak: Int
  let habitsCompleted: Int
  let habitsTotal: Int
  let countdownName: String?
  let countdownDays: Int?
}

struct TazqProvider: TimelineProvider {
  func placeholder(in context: Context) -> TazqEntry {
    TazqEntry(date: .now, streak: 7, habitsCompleted: 3, habitsTotal: 5, countdownName: nil, countdownDays: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (TazqEntry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TazqEntry>) -> Void) {
    let entry = loadEntry()
    // Refresh every 30 minutes
    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: .now) ?? .now
    completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
  }

  private func loadEntry() -> TazqEntry {
    let defaults = UserDefaults(suiteName: appGroupID)
    let streak = defaults?.integer(forKey: "streak") ?? 0
    let habitsCompleted = defaults?.integer(forKey: "habitsCompletedToday") ?? 0
    let habitsTotal = defaults?.integer(forKey: "habitsTotal") ?? 0
    let cdName = defaults?.string(forKey: "countdownName")
    let cdDays = defaults?.object(forKey: "countdownDays") as? Int
    return TazqEntry(
      date: .now,
      streak: streak,
      habitsCompleted: habitsCompleted,
      habitsTotal: habitsTotal,
      countdownName: cdName,
      countdownDays: cdDays
    )
  }
}

// MARK: - Complication Views

struct TazqComplication: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TazqComplication", provider: TazqProvider()) { entry in
      TazqComplicationView(entry: entry)
    }
    .configurationDisplayName("Tazq")
    .description("Streak, alışkanlık ve geri sayım")
    .supportedFamilies([
      .accessoryCircular,
      .accessoryRectangular,
      .accessoryCorner,
      .accessoryInline,
    ])
  }
}

struct TazqComplicationView: View {
  let entry: TazqEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    switch family {
    case .accessoryCircular:
      CircularView(entry: entry)
    case .accessoryRectangular:
      RectangularView(entry: entry)
    case .accessoryCorner:
      CornerView(entry: entry)
    case .accessoryInline:
      InlineView(entry: entry)
    default:
      CircularView(entry: entry)
    }
  }
}

// Small circular: Streak count
struct CircularView: View {
  let entry: TazqEntry
  var body: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 0) {
        Text("🔥")
          .font(.system(size: 12))
        Text("\(entry.streak)")
          .font(.system(size: 14, weight: .black))
          .foregroundColor(.orange)
      }
    }
  }
}

// Rectangular: Habits progress
struct RectangularView: View {
  let entry: TazqEntry
  var pct: Double {
    guard entry.habitsTotal > 0 else { return 0 }
    return Double(entry.habitsCompleted) / Double(entry.habitsTotal)
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack {
        Text("Tazq")
          .font(.system(size: 11, weight: .black))
        Spacer()
        Text("🔥 \(entry.streak)")
          .font(.system(size: 11, weight: .bold))
          .foregroundColor(.orange)
      }
      ProgressView(value: pct)
        .tint(.green)
      Text("\(entry.habitsCompleted)/\(entry.habitsTotal) alışkanlık")
        .font(.system(size: 10))
        .foregroundColor(.secondary)
    }
    .padding(.horizontal, 4)
  }
}

// Corner: Streak
struct CornerView: View {
  let entry: TazqEntry
  var body: some View {
    Text("\(entry.streak)")
      .font(.system(size: 18, weight: .black))
      .foregroundColor(.orange)
      .widgetLabel { Text("🔥 Seri") }
  }
}

// Inline: Summary text
struct InlineView: View {
  let entry: TazqEntry
  var body: some View {
    if let name = entry.countdownName, let days = entry.countdownDays {
      Text("🎯 \(name) · \(days)g")
    } else {
      Text("🔥 \(entry.streak) · ✅ \(entry.habitsCompleted)/\(entry.habitsTotal)")
    }
  }
}

@main
struct TazqComplicationBundle: WidgetBundle {
  var body: some Widget {
    TazqComplication()
  }
}
