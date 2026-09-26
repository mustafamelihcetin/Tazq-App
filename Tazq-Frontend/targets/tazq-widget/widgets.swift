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
  let bgHex: String?
  let taskHex: String?
  let habitHex: String?
  let streakHex: String?
}

struct TazqProvider: TimelineProvider {
  func placeholder(in context: Context) -> TazqEntry {
    TazqEntry(date: .now, streak: 7, habitsCompleted: 3, habitsTotal: 5, tasksCompleted: 2, tasksTotal: 6, tr: true,
               countdownLabel: "YKS 2027", countdownDays: 42, countdownColorHex: "#0A84FF", countdownTextHex: "#0A84FF", countdownEmoji: "🎯",
               bgHex: nil, taskHex: nil, habitHex: nil, streakHex: nil)
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
      countdownEmoji: d?.string(forKey: "countdownEmoji"),
      bgHex: d?.string(forKey: "bgColor"),
      taskHex: d?.string(forKey: "taskColor"),
      habitHex: d?.string(forKey: "habitColor"),
      streakHex: d?.string(forKey: "streakColor")
    )
  }
}

// MARK: - Renkler

// Telefon her push'ta GERÇEK marka renklerini yazıyor (bkz. widgetBridge.ts
// `bgColor`/`taskColor`/`habitColor`/`streakColor` — shared/constants/Colors.ts
// `dark` paletinden, burada kopyası TUTULMUYOR). Bu sabitler yalnız ilk açılışta
// (widget henüz hiç veri almamışken) ya da SwiftUI önizlemesinde kullanılan yedek.
private let fallbackBg = Color(hexOrNil: "#09090B")
private let fallbackStreak = Color(hexOrNil: "#FB923C")
private let fallbackHabit = Color(hexOrNil: "#34D399")
private let fallbackTask = Color(hexOrNil: "#0A84FF")

private extension Color {
  init(hexOrNil: String?) {
    guard let hex = hexOrNil else { self = .white; return }
    let h = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    var int: UInt64 = 0
    guard Scanner(string: h).scanHexInt64(&int), h.count == 6 else { self = .white; return }
    self.init(.sRGB, red: Double((int >> 16) & 0xFF) / 255, green: Double((int >> 8) & 0xFF) / 255, blue: Double(int & 0xFF) / 255, opacity: 1)
  }
}

// MARK: - Widget 1: Bugün (tek halka: görev + alışkanlık BİRLİKTE)

private struct TodayRing: View {
  let done: Int
  let total: Int
  let taskColor: Color
  let habitColor: Color

  var pct: Double { total > 0 ? Double(done) / Double(total) : 0 }

  var body: some View {
    ZStack {
      Circle()
        .stroke(Color.white.opacity(0.10), lineWidth: 9)
      Circle()
        .trim(from: 0, to: total > 0 ? pct : 0)
        .stroke(
          AngularGradient(colors: [taskColor, habitColor], center: .center),
          style: StrokeStyle(lineWidth: 9, lineCap: .round)
        )
        .rotationEffect(.degrees(-90))

      VStack(spacing: 0) {
        Text("\(done)")
          .font(.system(size: 26, weight: .black))
          .foregroundColor(.white)
        Text("/\(total)")
          .font(.system(size: 12, weight: .bold))
          .foregroundColor(.white.opacity(0.45))
      }
    }
  }
}

struct TazqTodayView: View {
  let entry: TazqEntry

  private var bg: Color { entry.bgHex != nil ? Color(hexOrNil: entry.bgHex) : fallbackBg }
  private var taskColor: Color { entry.taskHex != nil ? Color(hexOrNil: entry.taskHex) : fallbackTask }
  private var habitColor: Color { entry.habitHex != nil ? Color(hexOrNil: entry.habitHex) : fallbackHabit }
  private var streakColor: Color { entry.streakHex != nil ? Color(hexOrNil: entry.streakHex) : fallbackStreak }
  private var total: Int { entry.tasksTotal + entry.habitsTotal }
  private var done: Int { entry.tasksCompleted + entry.habitsCompleted }

  var body: some View {
    VStack(spacing: 8) {
      HStack {
        Text("TAZQ")
          .font(.system(size: 11, weight: .black))
          .foregroundColor(.white.opacity(0.5))
        Spacer()
        HStack(spacing: 3) {
          Text("🔥").font(.system(size: 10))
          Text("\(entry.streak)")
            .font(.system(size: 12, weight: .black))
            .foregroundColor(streakColor)
        }
      }

      if total > 0 {
        TodayRing(done: done, total: total, taskColor: taskColor, habitColor: habitColor)
          .frame(width: 74, height: 74)
          .padding(.top, 2)

        HStack(spacing: 10) {
          if entry.tasksTotal > 0 {
            HStack(spacing: 4) {
              Circle().fill(taskColor).frame(width: 6, height: 6)
              Text("\(entry.tasksCompleted)/\(entry.tasksTotal)")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.white.opacity(0.7))
            }
          }
          if entry.habitsTotal > 0 {
            HStack(spacing: 4) {
              Circle().fill(habitColor).frame(width: 6, height: 6)
              Text("\(entry.habitsCompleted)/\(entry.habitsTotal)")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.white.opacity(0.7))
            }
          }
        }
      } else {
        Spacer(minLength: 0)
        Text(entry.tr ? "Bugün için bir şey yok" : "Nothing due today")
          .font(.system(size: 12, weight: .medium))
          .foregroundColor(.white.opacity(0.6))
          .multilineTextAlignment(.center)
        Spacer(minLength: 0)
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .containerBackground(bg, for: .widget)
  }
}

struct TazqTodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TazqTodayWidget", provider: TazqProvider()) { entry in
      TazqTodayView(entry: entry)
    }
    .configurationDisplayName("TAZQ — Bugün")
    .description("Bugünkü görev ve alışkanlık ilerlemen, tek bakışta.")
    .supportedFamilies([.systemSmall])
  }
}

// MARK: - Widget 2: Geri Sayım (modun kendi rengiyle tonlanmış zemin)

struct TazqCountdownView: View {
  let entry: TazqEntry

  private var bg: Color { entry.bgHex != nil ? Color(hexOrNil: entry.bgHex) : fallbackBg }
  private var accent: Color { Color(hexOrNil: entry.countdownColorHex) }
  private var textAccent: Color { Color(hexOrNil: entry.countdownTextHex) }

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Text("TAZQ")
          .font(.system(size: 11, weight: .black))
          .foregroundColor(.white.opacity(0.4))
        Spacer()
        if let emoji = entry.countdownEmoji { Text(emoji).font(.system(size: 14)) }
      }

      Spacer(minLength: 0)

      if let days = entry.countdownDays, let label = entry.countdownLabel {
        Text("\(days)")
          .font(.system(size: 36, weight: .black))
          .foregroundColor(.white)
        Text(entry.tr ? "gün kaldı" : "days left")
          .font(.system(size: 9, weight: .bold))
          .foregroundColor(textAccent)
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
    .containerBackground(for: .widget) {
      // Modun kendi rengiyle tonlanmış zemin — her modda aynı düz laciverti
      // görmek yerine sınav mavi, tez mor, spor turuncu ışıltısı alır.
      ZStack {
        bg
        RadialGradient(colors: [accent.opacity(0.30), .clear], center: .topTrailing, startRadius: 4, endRadius: 130)
      }
    }
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
             countdownLabel: nil, countdownDays: nil, countdownColorHex: nil, countdownTextHex: nil, countdownEmoji: nil,
             bgHex: nil, taskHex: nil, habitHex: nil, streakHex: nil)
}

#Preview("Geri Sayım", as: .systemSmall) {
  TazqCountdownWidget()
} timeline: {
  TazqEntry(date: .now, streak: 12, habitsCompleted: 3, habitsTotal: 5, tasksCompleted: 2, tasksTotal: 6, tr: true,
             countdownLabel: "YKS 2027", countdownDays: 42, countdownColorHex: "#0A84FF", countdownTextHex: "#0A84FF", countdownEmoji: "🎯",
             bgHex: nil, taskHex: nil, habitHex: nil, streakHex: nil)
}
