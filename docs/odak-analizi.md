# Odak Sayfaları Analizi ve Eksikler Listesi

Tarih: 2026-11-05. Kapsam: Odak ekranı, Zen, sahneler, seans sonu, Haftanın Gökyüzü, Nefes.

**Yöntem:** Beş açık kaynak uygulamanın kodu okundu; Tazq'ın kodu aynı sorularla incelendi. Uygulamalar çalıştırılmadı, kullanıcı testi yapılmadı, Tazq'ın pil ve ısı değerleri cihazda ölçülmedi. Puanlar yargıdır, ölçüm değildir.

**Lisans:** GoodTime, Tomato GPL; Pomodoist AGPL; Reef özel koşullu (atıf ve marka); FocusTide MIT. Yalnız fikir alınır, kod kopyalanmaz.

## İncelenen repolar

| Repo | Yıldız | Okunan kod | Çıkan ders |
|---|---|---|---|
| [adrcotfas/goodtime](https://github.com/adrcotfas/goodtime) | 1.931 | `Session.kt`, `BreakBudgetManager.kt`, `TimerManager.kt`, `FinishedSessionContent.kt` | Seans kaydı etiket, not ve kesinti süresi taşır; süre yukarı sayınca mola bütçesi birikir; alarmdan sonra geçen süre seansa eklenebilir |
| [nsh07/Tomato](https://github.com/nsh07/Tomato) | 1.526 | `Stat.kt`, `Topic.kt` | İstatistik gün ve konu bazında, günün dört dilimine bölünmüş; her konunun kendi süresi ve Rahatsız Etmeyin ayarı var |
| [aload0/Reef](https://github.com/aload0/Reef) | 365 | `TimerState.kt`, `TimerScreen.kt`, `MindfulLaunchManager.kt` | Yukarı sayımda mola oranı (varsayılan 5'e 1); yukarı sayımda katı mod kapanır; dikkat dağıtan uygulama açılırken 10 sn bekletme |
| [Hanziness/FocusTide](https://github.com/Hanziness/FocusTide) | 403 | `timerApproximate.vue`, `adaptiveTickingMultipliers.ts` | Sayaç stili saate bakmayı azaltır (tam, yaklaşık, yüzde); yazı görünmezken güncelleme seyrekleşir |
| [Kabanya/Pomodoist](https://github.com/Kabanya/Pomodoist) | 528 | `live_focus_repository.dart`, `distraction_protection_coordinator.dart`, `platform_quick_add.dart` | Odak koşusu `taskId` ile kaydedilir; hızlı görev ekleme ve dikkat koruması odakla bağlı |

React Native'de anlamlı örnek bulunamadı (en iyisi 4 yıldız).

## Karşılaştırma

✓ kodda ya da README'de görüldü. "–" bu incelemede görülmedi, yok demek değildir.

| Yetenek | Tazq | GoodTime | Tomato | Reef | FocusTide | Pomodoist |
|---|---|---|---|---|---|---|
| Seans ne için yapıldı, kalıcı | Hayır | ✓ etiket | ✓ konu | – | – | ✓ görev |
| Yukarı sayan akış modu | Hayır | ✓ | – | ✓ | – | – |
| Odak süresine göre mola | Hayır | ✓ | – | ✓ | – | – |
| Seans sonu not | Hayır | ✓ | – | – | – | – |
| Süre dolunca devam etmek | Yalnız +5 dk | ✓ | – | – | ✓ | – |
| Kesinti kaydı | Hayır | ✓ | – | – | – | – |
| Seans içi hızlı görev ekleme | Hayır | – | – | – | – | ✓ |
| Rahatsız Etmeyin | Hayır | ✓ | ✓ | ✓ | – | – |
| Uygulama engelleme | Hayır | – | – | ✓ | – | ✓ |
| Saate bakmayı azaltma | ✓ Zen yörüngesi | – | – | – | ✓ | – |
| Günün saatine göre analiz | ✓ | – | ✓ | – | – | – |
| Tek saat, tek kayıt kilidi, çevrimdışı kuyruk | ✓ | ✓ kısmen görüldü | – | – | – | – |
| Sahne, odakla büyüyen dünya, nefes seansı | ✓ | – | – | – | – | – |

## Eksikler listesi

Öncelik: **P0** bugünkü hatalar, **P1** ürünün değerini değiştirir, **P2** kalite, **P3** sonra ya da yeni derleme ister.

| # | Öncelik | Eksik | Kanıt | Yön | İş |
|---|---|---|---|---|---|
| 1 | P0 | Pomodoro'da ve +5 dk'da dünya sıfırlanıyor | `worldFor` yeni süreyi yeni seans sayar; `setDuration` | Dünya tur ve uzatma boyunca birikir | Küçük |
| 2 | P0 | Pomodoro turunda seans sonu özeti yok | `app/focus.tsx`: `setSummaryVisible` yalnız standart akışta | Kısa tur özeti, araya girmeyen | Küçük |
| 3 | P0 | Katı modda arama ve kilit de seansı bitiriyor | `session.ts`: her `background` 10 sn sayaç başlatır | Önce iOS'ta aramanın yansıması doğrulanır, sonra ayrım | Orta |
| 4 | P1 | Seansın ne için yapıldığı kayboluyor | `saveSession('Focus', ...)` sabit; `FocusSessionRow` yalnız başlangıç ve dakika | Görev adı gönderilir, geçmişte döner, gökyüzünde görünür. Sunucu alanı zaten var ve şifreli; yanıt genişler, deploy gerekir | Orta |
| 5 | P1 | Seans içinde akla geleni yazacak yer yok | Odak ekranında yakalama yok; `features/tasks/nlp/capture.ts` hazır | Çıkmadan tek satır yakalama, seans sonunda gösterim | Orta |
| 6 | P1 | Serbest süre yok, üst sınır 120 dk | `DIAL_MAX = 120`; yukarı sayım yok | Yukarı sayım ve kazanılan mola; dünya büyümesi süreden bağımsız kurgulanır | Büyük |
| 7 | P2 | Süre dolunca akışı bozmadan devam edilemiyor | Yalnız +5 dk, yeni seans sayılıyor | Alarmdan sonraki süre aynı seansa eklenebilir | Orta |
| 8 | P2 | Seans sonu not alanı yok | Puanlama da kaldırıldı | İsteğe bağlı tek satır, kapalı başlar | Küçük |
| 9 | P2 | Boş ekran kalabalık (9 bölge) | Gün şeridi, rozet, top, kadran, ipucu, görev, 3 düğme, ses satırı, söz | Az kullanılanlar seçim anına taşınır | Orta |
| 10 | P2 | Üstteki yazıların okunurluğu | Ekran görüntüsü; ipucu %45 beyaz, Zen çıkışı 10 pt | Kontrast ölçülür, boyut token'a çekilir | Küçük |
| 11 | P2 | 9 ses tek satırda, çoğu ekran dışında | `app/focus.tsx` yatay kaydırma | Sahne önerisi önde, gerisi açılır | Küçük |
| 12 | P2 | Dokunulmayan ekran pili yakıyor | Seans boyunca ekran açık ve sahne çiziliyor | Uzun süre dokunulmazsa kararıp yavaşlama | Küçük |
| 13 | P2 | Performans ölçülmedi | Bilgisayar ölçümü GPU'yu temsil etmiyor | Cihazda 25 dk ısı, pil, kare ölçümü | Küçük |
| 14 | P2 | Uygulama kapatılınca seans testi cihazda yok | Birim testi var; GoodTime'da ayrı test modülü var | Maestro akışı | Orta |
| 15 | P2 | Duraklatma kaydedilmiyor | Yalnız dakika ve tamamlandı bilgisi | Kesinti süresi saklanır; yalnız kullanıcıya gösterilir | Orta |
| 16 | P3 | `app/focus.tsx` 2.100+ satır | Satır sayısı | Parça parça bölünür | Büyük |
| 17 | P3 | Kullanılmayan dosyalar | `LightsCollected.tsx`, `celebrationLottie.ts`, koç metinleri | Onayla silinir | Küçük |
| 18 | P3 | Puanlama verisi kesildi | `ux_rating_submitted` artık gönderilmiyor | Gerekliyse ayrı ve seyrek sorulur | Karar |
| 19 | P3 | Rahatsız Etmeyin | iOS uygulamadan açtırmaz; Android yerel modül ister | Yeni derlemeyle Android'de | Orta |

**Bilerek yapılmayanlar:** Uygulama engelleme (iOS özel izin ve yerel kod ister), sahte seans denetimi (gerçek kullanıcıyı cezalandırır), puan ve sıralama.

## Toplam sonuç

| Eksen | Puan | Not |
|---|---|---|
| Seans güvenilirliği | 9/10 | İncelenenlerle en az aynı seviye |
| Atmosfer ve özgünlük | 8/10 | Beş repoda karşılığı görülmedi; asıl farkımız |
| Haftalık anlam | 6/10 | Sayılar var, "ne için" yok |
| Seans başı sadeliği | 5/10 | |
| Senaryo kapsamı | 5/10 | Akış modu ve yakalama eksik |
| Dikkat koruma | 4/10 | Katı mod tek araç |
| Pil ve ısı | Ölçülmedi | |

**Sonuç: 6,2/10 (altı eksenin eşit ağırlıklı ortalaması, ölçülmeyen pil ekseni hariç).** Tazq en güvenilir ve en atmosferik olanlar arasında, ama basit bir soruda geride: "Bu hafta neye odaklandım?" Rakiplerin üçü bunu cevaplıyor. Sahneler kullanıcıyı çekiyor; seansın izini kalıcı kılmak onu tutar.

**Öncelik sırası:** 1, 2, 3 → 4 → 5 → 13 → 6.
