import SwiftUI

/*
  SALT-İZLEME — telefondaki odak seansının durumunu YALNIZ gösterir, başlatmaz/durdurmaz.

  Eskiden burada tam işlevli bir Start/Stop butonu ve süre seçici vardı. Ama telefon
  tarafı (bkz. widgetBridge.ts `initWatchBridge`, TazqWidgetBridgeModule.swift) Watch'tan
  gelen "focusAction" mesajlarını BİLEREK dinlemiyor — telefondaki odak akışı commit/claim
  adımlarıyla bir durum makinesi, Watch'tan körlemesine yazmak yarım/çift oturum riski
  taşıyor. Sonuç: kullanıcı Watch'ta "başlat"a basıp kendi yerel sayacını izliyordu ama
  hiçbir gerçek seans kaydolmuyordu — telefonu açtığında hiçbir şey eşleşmiyordu. Bu,
  kullanıcıyı yanıltan bir tasarım/uygulama uyuşmazlığıydı (2026-09'da düzeltildi).
  `store.focusActive`/`focusElapsedSeconds`/`focusTotalSeconds` hâlâ telefondan
  `applyData` ile güncelleniyor — bu ekran o durumu YANSITMAYA devam ediyor.
*/
struct FocusView: View {
  @EnvironmentObject var store: SessionStore
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

      if store.focusActive {
        Text(tr ? "Odaklan 🔥" : "Stay focused 🔥")
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(.orange)
      } else {
        Text(tr ? "Telefondan başlat" : "Start from your phone")
          .font(.system(size: 11))
          .foregroundColor(.secondary)
          .multilineTextAlignment(.center)
      }
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 8)
  }
}
