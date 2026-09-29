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
  let taskTitles: [String]
  let tr: Bool
  let countdownLabel: String?
  let countdownDays: Int?
  let countdownColorHex: String?
  let countdownTextHex: String?
  let countdownEmoji: String?
  let countdown2Label: String?
  let countdown2Days: Int?
  let countdown2ColorHex: String?
  let countdown2TextHex: String?
  let countdown2Emoji: String?
  let bgHex: String?
  let taskHex: String?
  let habitHex: String?
  let streakHex: String?
  /*
    2026-09'da eklendi — ÖNCEDEN metin rengi her yerde SABİT beyazdı ("widget zemini
    hep koyu" varsayımıyla). Kullanıcı açık temadaysa telefon artık AÇIK zemin
    (`bgHex`) gönderiyor (bkz. widgetBridge.ts `resolveIsDark`) — ama zemin açıksa
    beyaz yazı okunmaz olurdu. Bu alan, her metnin `onBg(isDark:)` ile zemine göre
    beyaz/siyah seçmesini sağlıyor. Eski/gelmemiş veri için `true` varsayılıyor
    (önceki sabit-koyu davranışla aynı — geriye dönük kırılma yok).
  */
  let isDark: Bool
}

struct TazqProvider: TimelineProvider {
  func placeholder(in context: Context) -> TazqEntry {
    TazqEntry(date: .now, streak: 7, habitsCompleted: 3, habitsTotal: 5, tasksCompleted: 2, tasksTotal: 6,
               taskTitles: ["Rapor taslağını bitir", "Market listesi", "30 dk koş"], tr: true,
               countdownLabel: "YKS 2027", countdownDays: 42, countdownColorHex: "#0A84FF", countdownTextHex: "#0A84FF", countdownEmoji: "🎯",
               countdown2Label: "Tez Savunması", countdown2Days: 88, countdown2ColorHex: "#8B5CF6", countdown2TextHex: "#8B5CF6", countdown2Emoji: "📚",
               bgHex: nil, taskHex: nil, habitHex: nil, streakHex: nil, isDark: true)
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
    var titles: [String] = []
    if let json = d?.string(forKey: "taskTitlesJson"), let data = json.data(using: .utf8) {
      titles = (try? JSONDecoder().decode([String].self, from: data)) ?? []
    }
    return TazqEntry(
      date: .now,
      streak: d?.integer(forKey: "streak") ?? 0,
      habitsCompleted: d?.integer(forKey: "habitsCompletedToday") ?? 0,
      habitsTotal: d?.integer(forKey: "habitsTotal") ?? 0,
      tasksCompleted: d?.integer(forKey: "tasksCompletedToday") ?? 0,
      tasksTotal: d?.integer(forKey: "tasksTotal") ?? 0,
      taskTitles: titles,
      tr: (d?.string(forKey: "language") ?? "tr") == "tr",
      countdownLabel: d?.string(forKey: "countdownLabel"),
      countdownDays: d?.object(forKey: "countdownDays") as? Int,
      countdownColorHex: d?.string(forKey: "countdownColor"),
      countdownTextHex: d?.string(forKey: "countdownTextColor"),
      countdownEmoji: d?.string(forKey: "countdownEmoji"),
      countdown2Label: d?.string(forKey: "countdown2Label"),
      countdown2Days: d?.object(forKey: "countdown2Days") as? Int,
      countdown2ColorHex: d?.string(forKey: "countdown2Color"),
      countdown2TextHex: d?.string(forKey: "countdown2TextColor"),
      countdown2Emoji: d?.string(forKey: "countdown2Emoji"),
      bgHex: d?.string(forKey: "bgColor"),
      taskHex: d?.string(forKey: "taskColor"),
      habitHex: d?.string(forKey: "habitColor"),
      streakHex: d?.string(forKey: "streakColor"),
      isDark: d?.object(forKey: "isDark") as? Bool ?? true
    )
  }
}

// MARK: - Renkler

// Telefon her push'ta GERÇEK marka renklerini yazıyor (bkz. widgetBridge.ts
// `bgColor`/`taskColor`/`habitColor`/`streakColor` — kullanıcının GERÇEK açık/koyu
// tema tercihine göre `Colors.light`/`Colors.dark`'tan, burada kopyası TUTULMUYOR).
// Bu sabitler yalnız ilk açılışta (widget henüz hiç veri almamışken) ya da SwiftUI
// önizlemesinde kullanılan yedek — koyu tema varsayılan (isDark alanının varsayılanıyla aynı).
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

/// Zemine göre okunabilir metin rengi — koyu zeminde beyaz, açık zeminde siyah.
/// `opacity` ikincil/üçüncül metinler için (başlık/rakam dışındaki her şey).
private func onBg(_ isDark: Bool, _ opacity: Double = 1) -> Color {
  isDark ? Color.white.opacity(opacity) : Color.black.opacity(opacity)
}

// MARK: - Ortak parçalar

private struct TodayRing: View {
  let done: Int
  let total: Int
  let taskColor: Color
  let habitColor: Color
  let isDark: Bool
  var diameter: CGFloat = 74
  var lineWidth: CGFloat = 9
  var numberSize: CGFloat = 26

  var pct: Double { total > 0 ? Double(done) / Double(total) : 0 }

  var body: some View {
    ZStack {
      Circle().stroke(onBg(isDark, 0.10), lineWidth: lineWidth)
      Circle()
        .trim(from: 0, to: total > 0 ? pct : 0)
        .stroke(
          AngularGradient(colors: [taskColor, habitColor], center: .center),
          style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
        )
        .rotationEffect(.degrees(-90))

      VStack(spacing: 0) {
        Text("\(done)")
          .font(.system(size: numberSize, weight: .black))
          .foregroundColor(onBg(isDark))
        Text("/\(total)")
          .font(.system(size: numberSize * 0.46, weight: .bold))
          .foregroundColor(onBg(isDark, 0.45))
      }
    }
    .frame(width: diameter, height: diameter)
  }
}

/// Widget'ın kendi görev satırı — DOKUNULAMAZ (WidgetKit'te işaretleme için App
/// Intent gerekir, ayrı ve daha riskli bir iş; bu ilk sürüm salt-okunur bir liste).
/// Boş daire "henüz açık" der, dolduramama bilerek — sahte bir buton görünmesin.
private struct TaskRow: View {
  let title: String
  let color: Color
  let isDark: Bool
  var body: some View {
    HStack(spacing: 7) {
      Circle()
        .stroke(color.opacity(0.55), lineWidth: 1.5)
        .frame(width: 13, height: 13)
      Text(title)
        .font(.system(size: 12, weight: .medium))
        .foregroundColor(onBg(isDark, 0.85))
        .lineLimit(1)
    }
  }
}

private struct StreakBadge: View {
  let streak: Int
  let color: Color
  var body: some View {
    HStack(spacing: 3) {
      Text("🔥").font(.system(size: 10))
      Text("\(streak)")
        .font(.system(size: 12, weight: .black))
        .foregroundColor(color)
    }
  }
}

private struct EmptyTodayNote: View {
  let tr: Bool
  let isDark: Bool
  var body: some View {
    Text(tr ? "Bugün için bir şey yok" : "Nothing due today")
      .font(.system(size: 12, weight: .medium))
      .foregroundColor(onBg(isDark, 0.6))
      .multilineTextAlignment(.center)
  }
}

/// Görev listesi boşken (yalnız alışkanlık kullanan kullanıcı) — köprü alışkanlık
/// ADI taşımıyor, o yüzden isim listesi yerine ilerleme gösteriliyor; ama en azından
/// "bugün için bir şey yok" gibi YANLIŞ bir şey söylemiyor.
private struct HabitsOnlyNote: View {
  let entry: TazqEntry
  let color: Color
  private var pct: Double { entry.habitsTotal > 0 ? Double(entry.habitsCompleted) / Double(entry.habitsTotal) : 0 }

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(entry.tr ? "Bugünkü alışkanlıklar" : "Today's habits")
        .font(.system(size: 12, weight: .medium))
        .foregroundColor(onBg(entry.isDark, 0.75))
      HStack(spacing: 6) {
        GeometryReader { geo in
          ZStack(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2.5).fill(onBg(entry.isDark, 0.12))
            RoundedRectangle(cornerRadius: 2.5).fill(color).frame(width: geo.size.width * pct)
          }
        }
        .frame(height: 5)
        Text("\(entry.habitsCompleted)/\(entry.habitsTotal)")
          .font(.system(size: 11, weight: .bold))
          .foregroundColor(onBg(entry.isDark, 0.7))
      }
    }
  }
}

// MARK: - Widget 1: Bugün (küçük: halka · orta/büyük: gerçek görev listesi)

struct TazqTodayView: View {
  let entry: TazqEntry
  @Environment(\.widgetFamily) var family

  private var bg: Color { entry.bgHex != nil ? Color(hexOrNil: entry.bgHex) : fallbackBg }
  private var taskColor: Color { entry.taskHex != nil ? Color(hexOrNil: entry.taskHex) : fallbackTask }
  private var habitColor: Color { entry.habitHex != nil ? Color(hexOrNil: entry.habitHex) : fallbackHabit }
  private var streakColor: Color { entry.streakHex != nil ? Color(hexOrNil: entry.streakHex) : fallbackStreak }
  private var total: Int { entry.tasksTotal + entry.habitsTotal }
  private var done: Int { entry.tasksCompleted + entry.habitsCompleted }

  private var header: some View {
    HStack {
      Text("TAZQ")
        .font(.system(size: 11, weight: .black))
        .foregroundColor(onBg(entry.isDark, 0.5))
      Spacer()
      StreakBadge(streak: entry.streak, color: streakColor)
    }
  }

  private var categoryDots: some View {
    HStack(spacing: 10) {
      if entry.tasksTotal > 0 {
        HStack(spacing: 4) {
          Circle().fill(taskColor).frame(width: 6, height: 6)
          Text("\(entry.tasksCompleted)/\(entry.tasksTotal)")
            .font(.system(size: 10, weight: .bold)).foregroundColor(onBg(entry.isDark, 0.7))
        }
      }
      if entry.habitsTotal > 0 {
        HStack(spacing: 4) {
          Circle().fill(habitColor).frame(width: 6, height: 6)
          Text("\(entry.habitsCompleted)/\(entry.habitsTotal)")
            .font(.system(size: 10, weight: .bold)).foregroundColor(onBg(entry.isDark, 0.7))
        }
      }
    }
  }

  /// Küçük — mevcut tasarım: tek halka, kategori noktaları altında.
  private var smallBody: some View {
    VStack(spacing: 8) {
      header
      if total > 0 {
        TodayRing(done: done, total: total, taskColor: taskColor, habitColor: habitColor, isDark: entry.isDark)
          .padding(.top, 2)
        categoryDots
      } else {
        Spacer(minLength: 0)
        EmptyTodayNote(tr: entry.tr, isDark: entry.isDark)
        Spacer(minLength: 0)
      }
    }
  }

  /// Orta — YATAY: solda küçük halka+seri, sağda gerçek görev başlıkları (ilk 3).
  /// Kullanıcı raporu tam buydu: "sadece grafik, görev isimleri yok".
  private var mediumBody: some View {
    HStack(alignment: .center, spacing: 16) {
      VStack(spacing: 6) {
        TodayRing(done: done, total: total, taskColor: taskColor, habitColor: habitColor, isDark: entry.isDark, diameter: 58, lineWidth: 7, numberSize: 20)
        StreakBadge(streak: entry.streak, color: streakColor)
      }
      .frame(width: 70)

      VStack(alignment: .leading, spacing: 7) {
        Text(entry.tr ? "BUGÜN" : "TODAY")
          .font(.system(size: 10, weight: .black))
          .foregroundColor(onBg(entry.isDark, 0.4))
        if !entry.taskTitles.isEmpty {
          ForEach(entry.taskTitles.prefix(3), id: \.self) { title in
            TaskRow(title: title, color: taskColor, isDark: entry.isDark)
          }
        } else if entry.habitsTotal > 0 {
          // Görev yok ama alışkanlık VAR — "bugün için bir şey yok" demek burada
          // YANLIŞ olurdu (bkz. aşağıdaki not, largeBody ile aynı düzeltme).
          HabitsOnlyNote(entry: entry, color: habitColor)
        } else {
          EmptyTodayNote(tr: entry.tr, isDark: entry.isDark)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  /// Büyük — TAM liste (ilk 6 görev) + alt bilgi şeridi (alışkanlık + seri).
  private var largeBody: some View {
    VStack(alignment: .leading, spacing: 10) {
      header

      if !entry.taskTitles.isEmpty {
        VStack(alignment: .leading, spacing: 9) {
          ForEach(entry.taskTitles.prefix(6), id: \.self) { title in
            TaskRow(title: title, color: taskColor, isDark: entry.isDark)
          }
        }
        Spacer(minLength: 0)
      } else if entry.habitsTotal > 0 {
        /*
          YALNIZ ALIŞKANLIK KULLANAN kullanıcı için gerçek bug: bu dal eskiden
          `entry.taskTitles.isEmpty` tek başına "bugün için bir şey yok" diyordu —
          alışkanlıkları olan ama hiç görevi olmayan biri widget'ında yanlışlıkla
          boş bir gün görüyordu. Görev başlığı yok (köprü yalnız görev adı taşıyor)
          ama en azından alışkanlık ilerlemesi doğru gösterilsin.
        */
        Spacer(minLength: 0)
        HabitsOnlyNote(entry: entry, color: habitColor)
        Spacer(minLength: 0)
      } else {
        Spacer(minLength: 0)
        EmptyTodayNote(tr: entry.tr, isDark: entry.isDark)
        Spacer(minLength: 0)
      }

      Divider().background(onBg(entry.isDark, 0.1))
      HStack {
        Text("\(entry.tr ? "Görevler" : "Tasks") \(entry.tasksCompleted)/\(entry.tasksTotal)")
          .font(.system(size: 10, weight: .bold)).foregroundColor(onBg(entry.isDark, 0.6))
        Spacer()
        if entry.habitsTotal > 0 {
          Text("\(entry.tr ? "Alışkanlık" : "Habits") \(entry.habitsCompleted)/\(entry.habitsTotal)")
            .font(.system(size: 10, weight: .bold)).foregroundColor(onBg(entry.isDark, 0.6))
        }
      }
    }
  }

  var body: some View {
    Group {
      switch family {
      case .systemMedium: mediumBody
      case .systemLarge: largeBody
      default: smallBody
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: family == .systemSmall ? .center : .leading)
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
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

// MARK: - Widget 2: Geri Sayım (modun kendi rengiyle tonlanmış zemin)

private struct CountdownBlock: View {
  let tr: Bool
  let label: String?
  let days: Int?
  let colorHex: String?
  let textHex: String?
  let emoji: String?
  let isDark: Bool
  var numberSize: CGFloat = 36

  private var textAccent: Color { Color(hexOrNil: textHex) }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if let emoji { Text(emoji).font(.system(size: 14)) }
      if let days, let label {
        Text("\(days)")
          .font(.system(size: numberSize, weight: .black))
          .foregroundColor(onBg(isDark))
        Text(tr ? "gün kaldı" : "days left")
          .font(.system(size: 9, weight: .bold))
          .foregroundColor(textAccent)
          .textCase(.uppercase)
        Text(label)
          .font(.system(size: 11, weight: .semibold))
          .foregroundColor(onBg(isDark, 0.7))
          .lineLimit(1)
      } else {
        Text(tr ? "Aktif bir dönemin yok" : "No active period")
          .font(.system(size: 12, weight: .medium))
          .foregroundColor(onBg(isDark, 0.6))
        Text(tr ? "Uygulamadan bir mod başlat" : "Start a mode in the app")
          .font(.system(size: 10))
          .foregroundColor(onBg(isDark, 0.4))
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct TazqCountdownView: View {
  let entry: TazqEntry
  @Environment(\.widgetFamily) var family

  private var bg: Color { entry.bgHex != nil ? Color(hexOrNil: entry.bgHex) : fallbackBg }
  private var accent: Color { Color(hexOrNil: entry.countdownColorHex) }

  private var smallBody: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Text("TAZQ").font(.system(size: 11, weight: .black)).foregroundColor(onBg(entry.isDark, 0.4))
        Spacer()
      }
      Spacer(minLength: 0)
      CountdownBlock(tr: entry.tr, label: entry.countdownLabel, days: entry.countdownDays, colorHex: entry.countdownColorHex, textHex: entry.countdownTextHex, emoji: entry.countdownEmoji, isDark: entry.isDark)
    }
  }

  /// Orta — birden fazla aktif dönemin varsa ikisi yan yana (tek moda düşmüyor).
  private var mediumBody: some View {
    HStack(alignment: .top, spacing: 18) {
      CountdownBlock(tr: entry.tr, label: entry.countdownLabel, days: entry.countdownDays, colorHex: entry.countdownColorHex, textHex: entry.countdownTextHex, emoji: entry.countdownEmoji, isDark: entry.isDark, numberSize: 30)
      if entry.countdown2Days != nil {
        Rectangle().fill(onBg(entry.isDark, 0.1)).frame(width: 1)
        CountdownBlock(tr: entry.tr, label: entry.countdown2Label, days: entry.countdown2Days, colorHex: entry.countdown2ColorHex, textHex: entry.countdown2TextHex, emoji: entry.countdown2Emoji, isDark: entry.isDark, numberSize: 30)
      }
    }
  }

  var body: some View {
    Group {
      switch family {
      case .systemMedium: mediumBody
      default: smallBody
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .containerBackground(for: .widget) {
      // Modun kendi rengiyle tonlanmış zemin — her modda aynı düz laciverti
      // görmek yerine sınav mavi, tez mor, spor turuncu ışıltısı alır.
      ZStack {
        bg
        RadialGradient(colors: [accent.opacity(0.30), .clear], center: .topTrailing, startRadius: 4, endRadius: 160)
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
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

#Preview("Bugün — Küçük", as: .systemSmall) {
  TazqTodayWidget()
} timeline: {
  TazqEntry(date: .now, streak: 12, habitsCompleted: 3, habitsTotal: 5, tasksCompleted: 2, tasksTotal: 6,
             taskTitles: ["Rapor taslağını bitir", "Market listesi", "30 dk koş"], tr: true,
             countdownLabel: nil, countdownDays: nil, countdownColorHex: nil, countdownTextHex: nil, countdownEmoji: nil,
             countdown2Label: nil, countdown2Days: nil, countdown2ColorHex: nil, countdown2TextHex: nil, countdown2Emoji: nil,
             bgHex: nil, taskHex: nil, habitHex: nil, streakHex: nil, isDark: true)
}

#Preview("Bugün — Orta", as: .systemMedium) {
  TazqTodayWidget()
} timeline: {
  TazqEntry(date: .now, streak: 12, habitsCompleted: 3, habitsTotal: 5, tasksCompleted: 2, tasksTotal: 6,
             taskTitles: ["Rapor taslağını bitir", "Market listesi", "30 dk koş", "E-postaları yanıtla"], tr: true,
             countdownLabel: nil, countdownDays: nil, countdownColorHex: nil, countdownTextHex: nil, countdownEmoji: nil,
             countdown2Label: nil, countdown2Days: nil, countdown2ColorHex: nil, countdown2TextHex: nil, countdown2Emoji: nil,
             bgHex: nil, taskHex: nil, habitHex: nil, streakHex: nil, isDark: true)
}

#Preview("Bugün — Büyük", as: .systemLarge) {
  TazqTodayWidget()
} timeline: {
  TazqEntry(date: .now, streak: 12, habitsCompleted: 3, habitsTotal: 5, tasksCompleted: 2, tasksTotal: 6,
             taskTitles: ["Rapor taslağını bitir", "Market listesi", "30 dk koş", "E-postaları yanıtla", "Kitap oku", "Faturaları öde"], tr: true,
             countdownLabel: nil, countdownDays: nil, countdownColorHex: nil, countdownTextHex: nil, countdownEmoji: nil,
             countdown2Label: nil, countdown2Days: nil, countdown2ColorHex: nil, countdown2TextHex: nil, countdown2Emoji: nil,
             bgHex: nil, taskHex: nil, habitHex: nil, streakHex: nil, isDark: true)
}

#Preview("Geri Sayım — Küçük", as: .systemSmall) {
  TazqCountdownWidget()
} timeline: {
  TazqEntry(date: .now, streak: 12, habitsCompleted: 3, habitsTotal: 5, tasksCompleted: 2, tasksTotal: 6,
             taskTitles: [], tr: true,
             countdownLabel: "YKS 2027", countdownDays: 42, countdownColorHex: "#0A84FF", countdownTextHex: "#0A84FF", countdownEmoji: "🎯",
             countdown2Label: nil, countdown2Days: nil, countdown2ColorHex: nil, countdown2TextHex: nil, countdown2Emoji: nil,
             bgHex: nil, taskHex: nil, habitHex: nil, streakHex: nil, isDark: true)
}

#Preview("Geri Sayım — Orta", as: .systemMedium) {
  TazqCountdownWidget()
} timeline: {
  TazqEntry(date: .now, streak: 12, habitsCompleted: 3, habitsTotal: 5, tasksCompleted: 2, tasksTotal: 6,
             taskTitles: [], tr: true,
             countdownLabel: "YKS 2027", countdownDays: 42, countdownColorHex: "#0A84FF", countdownTextHex: "#0A84FF", countdownEmoji: "🎯",
             countdown2Label: "Tez Savunması", countdown2Days: 88, countdown2ColorHex: "#8B5CF6", countdown2TextHex: "#8B5CF6", countdown2Emoji: "📚",
             bgHex: nil, taskHex: nil, habitHex: nil, streakHex: nil, isDark: true)
}
