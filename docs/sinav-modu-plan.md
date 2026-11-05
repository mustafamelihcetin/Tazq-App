# Sınav Modu v2: uygulama planı (2026-11-05)

Tasarım: [sinav-modu-tasarim.md](sinav-modu-tasarim.md). Commit yok; her adım test + `tsc` ile biter, telefon denemesi adb ile en sonda.

## Mimari kararlar

- **Yer:** `features/studyplan/` (saf çekirdek + store + bileşen). Ekran: `app/plan.tsx`.
- **Mevcut yol korunur:** Slotlar (`exam/exam2/exam3`), habit rutinleri, mod kapatma, duraklatma aynı. `usePlanAdaptations` yalnız görevin KAYNAĞINI değiştirir: planı olan slot için havuz yerine planlayıcı.
- **Bilinmeyen sınav bozulmaz:** Konu yoksa eski motor çalışır, ekran "konularını ekle" der.
- **Veri:** Konu durumu + gün özeti + deneme. Tam olay günlüğü yerine konu başına son yazan kazanır, denemeler birleşir. Sebep: `User.Preferences` 200 KB sınırı.
- **Bugün geri alınabilir:** Günün işaretleri ertesi güne kadar konu durumuna yazılmaz; görevi geri alan kullanıcı planı bozmaz.
- **Görev köprüsü:** Görev etiketi `sb_<gün>_<slot>_<n>`. Biten görev bloğu işaretler; dün bitmeyen plan görevi kaldırılır, gecikmişe düşmez.
- **Takvim sabitliği:** Bugünden 7 gün sabit (kayan pencere). Tarih, süre, seviye değişince ve kopuş dönüşünde yeniden kurulur.
- **Yeni yerel bağımlılık yok:** `expo-localization` zaten kurulu, yeni derleme şartı doğmaz.

## Görevler

| # | Görev | Doğrulama | Durum |
|---|---|---|---|
| 1 | Çekirdek tipler + planlayıcı (kapasite, tekrar, deneme, son tur, üst üste sınırı, sığma, çoklu sınav) | `studyPlanScheduler.test.ts`: bitti tanımındaki kurallar + senaryo kataloğu | Bitti |
| 2 | Sınav haritası: KPSS/DGS/YKS/ALES/LGS payları, SAT/ACT/IELTS vb., puan modeli, eksik EN sınavları | `studyPlanBlueprint.test.ts`, mevcut `curriculum` testleri | Bitti |
| 3 | Store: plan, sabit pencere, gün kapanışı, kopuş, bulut birleştirme, çıkış/dışa aktarma | `studyPlanStore.test.ts` | Bitti |
| 4 | Görev köprüsü + `usePlanAdaptations` entegrasyonu, üretimde "çalışıldı" hatasının bitişi | `studyPlanBridge.test.ts` + mevcut plan testleri | Bitti |
| 5 | Ekran: bugün + durum satırı + geri dönüş/işaretsiz gün | `tsc`, tasarım korumaları | Bitti |
| 6 | Takvim + hafta başlangıcı (`MonthCalendar`) | `monthCalendar` testi | Bitti |
| 7 | Konu haritası + kurulum (haftalık süre, kapalı günler, seviye, kendi konuları, dersler) | store testleri | Bitti |
| 8 | Deneme kaydı + yanlış nedeni + plana etkisi (5 puan modeli) | `studyPlanMocks.test.ts` | Bitti |
| 9 | ExamCard bağlantıları + yanlış görev metinleri | mevcut testler | Bitti |
| 10 | Tüm test + `tsc` + cihaz denemesi | çıktı raporlanır | Bitti |

| 11 | **Sınavdan sonra (kullanıcı notu):** Ödemeler üst kutusu ödeme arttıkça karmaşıklaşıyor; daha anlaşılır, animasyonlu, betimleyici, minimalist. Takvim ve "Ayın diğer ödemeleri" sadeleşecek | cihaz + kullanıcı onayı | Yapıldı, onay bekliyor |

| 12 | **Kullanıcı notu:** Planı Başlat sayfası tüm modlarda sade ve animasyonlu | cihaz | Yapıldı, onay bekliyor |

Kontrol noktaları: 1-4 sonrası tam test; 5-8 sonrası `tsc` + koruma testleri; 10'da cihaz.

## Riskler

| Risk | Önlem |
|---|---|
| Plan görevleri eski temizlik/aktarma yollarına takılır | `sb_` etiketi aktarma listesinden çıkarılır; test |
| Bulut 200 KB'ı aşar | Konu başına özet, gün özeti cihazda; boyut testi |
| Boş bulut dolu yerel veriyi ezer | Birleştirme yalnız yenisini alır; test |
| Sınav verisi yanlış | Paylar kullanıcıya gösterilmez, yalnız sıralama için; süre ve yanlış katsayısı kaynaklı |
| Eski sürümdeki kullanıcı | Plan otomatik oluşur, zorunlu ekran yok |
