import AppIntents
import WidgetKit
import Foundation

/*
  DOKUNARAK YÖNETİLEN WIDGET (2026-11-01, kullanıcı: "kullanıcıların en kolay yönetebileceği bir widget olmalı").
  iOS 17+ etkileşimli widget: görev halkasına dokun → tamamlandı; alışkanlık simgesine dokun → bugün yapıldı/geri al.

  Eylem WIDGET sürecinde çalışır (uygulama açılmaz). İki iş yapar:
    1) Widget'ın gösterdiği listeyi HEMEN günceller (tik anında görünsün),
    2) eylemi App Group'taki kuyruğa yazar. Uygulama öne gelince kuyruğu okuyup GERÇEK yoldan uygular
       (görev: completeTask — sunucu + çevrimdışı kuyruk; alışkanlık: toggleDate). Bkz. widgetBridge.ts applyWidgetActions.
  Görev geri alınamaz (yanlışlıkla dokunma uygulamada tek dokunuşla geri alınır); alışkanlık iki yönlü.
*/
private let intentsGroupID = "group.com.tazqapp.tazq"

enum WidgetActionStore {
  static let queueKey = "widgetActionsJson"

  private static func readArray(_ d: UserDefaults, _ key: String) -> [[String: Any]] {
    guard let s = d.string(forKey: key), let data = s.data(using: .utf8),
          let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return [] }
    return arr
  }

  private static func writeArray(_ d: UserDefaults, _ key: String, _ arr: [[String: Any]]) {
    guard let data = try? JSONSerialization.data(withJSONObject: arr),
          let s = String(data: data, encoding: .utf8) else { return }
    d.set(s, forKey: key)
  }

  /// Aynı kalem için yalnız SON istek kalır (art arda iki dokunuş = son durum).
  static func enqueue(kind: String, id: String, done: Bool) {
    guard let d = UserDefaults(suiteName: intentsGroupID) else { return }
    var list = readArray(d, queueKey).filter { !(($0["kind"] as? String) == kind && ($0["id"] as? String) == id) }
    list.append(["kind": kind, "id": id, "done": done, "at": Date().timeIntervalSince1970 * 1000])
    if list.count > 50 { list = Array(list.suffix(50)) }
    writeArray(d, queueKey, list)
  }

  /// Widget'ın kendi listesinde kalemi işaretle + sayacı kaydır (iyimser; uygulama sonra gerçeğini yazar).
  static func markLocal(listKey: String, countKey: String, id: String, done: Bool) {
    guard let d = UserDefaults(suiteName: intentsGroupID) else { return }
    var list = readArray(d, listKey)
    var changed = false
    for i in list.indices where (list[i]["id"] as? String) == id {
      if (list[i]["done"] as? Bool ?? false) != done { list[i]["done"] = done; changed = true }
    }
    guard changed else { return }
    writeArray(d, listKey, list)
    let n = d.integer(forKey: countKey) + (done ? 1 : -1)
    d.set(max(0, n), forKey: countKey)
  }
}

@available(iOS 17.0, *)
struct CompleteTaskIntent: AppIntent {
  static let title: LocalizedStringResource = "Görevi tamamla"
  static let isDiscoverable: Bool = false

  @Parameter(title: "Görev") var taskId: String

  init() {}
  init(taskId: String) { self.taskId = taskId }

  func perform() async throws -> some IntentResult {
    WidgetActionStore.markLocal(listKey: "widgetTasksJson", countKey: "tasksCompletedToday", id: taskId, done: true)
    WidgetActionStore.enqueue(kind: "task", id: taskId, done: true)
    return .result()
  }
}

@available(iOS 17.0, *)
struct ToggleHabitIntent: AppIntent {
  static let title: LocalizedStringResource = "Alışkanlığı işaretle"
  static let isDiscoverable: Bool = false

  @Parameter(title: "Alışkanlık") var habitId: String
  @Parameter(title: "Yapıldı") var done: Bool

  init() {}
  init(habitId: String, done: Bool) { self.habitId = habitId; self.done = done }

  func perform() async throws -> some IntentResult {
    WidgetActionStore.markLocal(listKey: "widgetHabitsJson", countKey: "habitsCompletedToday", id: habitId, done: done)
    WidgetActionStore.enqueue(kind: "habit", id: habitId, done: done)
    return .result()
  }
}
