# A1 · Ekran envanteri (2026-10-31)

Kod değişmedi. Her ekran ve kart dört sorudan birine bağlandı:
**Bugün** (Ana sayfa) · **Bu hafta** (Haftalık) · **Hedefler** (Modlar) · **Geçmiş** (Rapor).
Kaynak: her ekranın render ettiği bileşenler + bileşenlerin başlık yorumları + `router.push` çağrıları.

## 1. Ekran → kart → soru

| Ekran | Kart / bölüm | Soru | Nereden açılıyor |
|---|---|---|---|
| Ana sayfa `index.tsx` | Panel `TodayRings` (yaşayan cümle, gün çiçeği, `TodayDetail`) | Bugün | sekme |
| | ↳ yatay sürükle = son 7 gün | **Geçmiş** | panel jesti |
| | `ModeTodayCard` (panelin üst yuvası) | Bugün (modun bugünü) | mod açıkken |
| | `MomentumPulse` (küre + 7 çubuk) | Bugün (skor) + son 7 gün | panel içi |
| | `TurkishModeBanner` (mod bandı) | **Hedefler** (plan kur/uygula) | mod açık, kapatılmamış |
| | `MyDayItem` listesi, `MyDayHabits` | Bugün | — |
| | `TazqZenCard`, `SomedayNudge`, `PaymentsSummaryCard` | Bugün (yalnız gerektiğinde çıkar) | koşullu |
| | Başlık: `StatusHub` → `StatusHubModal` | **Bu hafta** (odak KPI, haftalık öneriler) + Rapor'a bağlantı | başlık düğmesi |
| Gün `gun.tsx` | Saat ekseni, şimdi işareti, kapanış | Bugün (saat görünümü) | Haftalık başlığı, Görevler, sabah/akşam bildirimi — **Ana sayfadan yok** |
| Haftalık `cockpit.tsx` | `WeekPanel`, `WeekHabits`, alışkanlık ekleme | Bu hafta | sekme; alışkanlık riski bildirimi; ana sayfa "alışkanlık başlat" |
| | Başlık: Gün (Sunrise), Rapor (BarChart) | → Bugün, → Geçmiş | — |
| Rapor `report.tsx` | `WeekDisplay`, `WeekChart`, `HabitWeekList`, `WeekSky`, koç cümlesi | Geçmiş (+ kıyas) | Haftalık başlığı, StatusHubModal, haftalık bildirim |
| Modlar `modlar.tsx` | `ModeStatusCard` (geri sayım + **bugünün planı**) | Hedefler + **Bugün** | sekme, `ModeTodayCard` |
| | Yol haritası `ModeRoadmapSheet` | Hedefler (ileri) | kart |
| | `TurkishModeBanner` (önizleme/kurulum) | Hedefler | mod seçimi |
| | Başlık: Mod özeti | → Geçmiş | — |
| Mod özeti `mod-ozet.tsx` | `WeekBars`, `TrendLine` (son 4 hafta) | Geçmiş (modlar) | **yalnız Modlar'dan** |
| Odak `focus.tsx` | `FocusWeekStrip` (son 7 gün odak) | Odak bağlamı + son 7 gün | sekme |
| Profil `profile.tsx` | `ProgressCard` (madalyalar) | Geçmiş (ödüller) | ana sayfa avatar |

## 2. Kopyalar ve öneri

Karar senin; öneri sütunu yalnız öneridir. Her satır ayrı adımda uygulanır (A3).

| # | Kopya | Nerede | Öneri | Gerekçe |
|---|---|---|---|---|
| K-1 | **Modun bugünkü planı** | Ana sayfa `ModeTodayCard` + Modlar `ModeStatusCard` içindeki "bugünün planı" | Modlar'daki bölüm **bağlantıya döner** ("Bugünün planı Ana sayfada →"); geri sayım kalır | Bugün = Ana sayfa. Modlar'ın kendi sorusu geri sayım ve yol haritası. Planın v1 örneği. |
| K-2 | **Mod bandı ana sayfada** | `TurkishModeBanner` hem Ana sayfa hem Modlar | Ana sayfadaki **silinir** ya da yalnız plan **uygulanmamışken** tek satır bağlantı olur | Plan kurmak Hedefler işi; ana sayfada `ModeTodayCard` zaten modun bugününü gösteriyor. |
| K-3 | **Haftanın özeti ana sayfada** | `StatusHubModal` (odak KPI + öneriler) vs Haftalık + Rapor | Pencere **silinir**; başlık düğmesi doğrudan Haftalık'a gider (A5). Öneriler (koç kartları) Rapor'a taşınır | "İçgörü penceresi Geçmiş'e bağlanır" (v1 A2). Bugün ekranında haftanın sorusu. |
| K-4 | **Alışkanlık × hafta ızgarası** | Haftalık `WeekHabits` + Rapor `HabitWeekList` | **Kalır**, ama Rapor içinde bulunulan haftayı gösterirken "Bu hafta → Haftalık" bağlantısı | Rapor geçmiş haftalarda tek kaynak; yalnız içinde bulunulan hafta çakışıyor. |
| K-5 | **Son 7 gün ana sayfada** | Panel sürükleme + Momentum 7 çubuk | **Kalır** | İkisi de yakın zamanda senin isteğinle eklendi; bugünü kıyasla okutuyor, ayrı ekran değil. |
| K-6 | **Odak son 7 gün** | `FocusWeekStrip` vs Rapor odak grafiği | **Kalır** | Odak ekranının kendi sürekliliği; Rapor'un sorusunu (kıyas) sormuyor. |

## 3. Eksik bağlantılar (kopya değil ama sahiplik kuralını bozuyor)

| # | Eksik | Öneri |
|---|---|---|
| E-1 | Ana sayfadan **Gün** ekranına yol yok; oysa Gün = Bugün'ün saat görünümü | Panelde ya da başlıkta tek giriş (A5 ile birlikte) |
| E-2 | **Mod özeti** yalnız Modlar'dan açılıyor; Geçmiş'in sahibi Rapor | Rapor'a "Modların geçmişi →" satırı |
| E-3 | Ana sayfa başlığındaki iki düğme: Profil + StatusHub (Bu hafta) | A5: biri Haftalık, biri Rapor ya da Gün |

## 4. Silinirse dikkat (A3 için)

- `StatusHubModal`: tur adımı "haftalık özeti aç" buna işaret ediyor (`tourSteps`, `TourFeaturePreview` index eşlemesi) → önce eşleme kimliğe çevrilmeli.
- `TurkishModeBanner` ana sayfada: kapatma anahtarı (`dismissedBannerKey`) ve plan uygulama akışı buradan da tetikleniyor; Modlar'daki akışın tek giriş kalması doğrulanmalı.
- Bildirim yönlendirmeleri (`_layout.tsx`): `/gun`, `/cockpit`, `/report`, `/` — hiçbiri silinecek bir karta gitmiyor.

## 5. A3 ilerleme

| # | Durum | Not |
|---|---|---|
| K-3 | ✅ Kaldırıldı (2026-10-31) | Pencere + yalnız ona ait hesaplar (`insight`, `weeklyTips`, `lastWeekMinutes`) ve yardımcılar (`getSmartInsight`, `focusDelta`, `formatDeltaPct`, `sameSpanTotal`) silindi. Başlık düğmesi → Bu Hafta. İpucu testleri Rapor'a taşındı. Tur riski yoktu (tur v2 pencereyi hedeflemiyor). |
| K-2 | ✅ Kaldırıldı (2026-10-31) | Puan anahtarı tek fonksiyonda (`dayRatingKey`, YKS/KPSS → exam yuvası); ana sayfa puanı ekrana her dönüşte okur. Kullanılmayan `dismissedBannerKey` tercihi silindi. |
| K-1 | ✅ Bağlantıya döndü (2026-10-31) | Hedefler durum kartında çubuk yerine "Bugünün planı 0/3 ›" → `goHome`. Cihazda doğrulandı. **Açık:** aynı ekranda sol üst "0/3" hapı ve mod kartındaki "Bugün 0/3" çubuğu hâlâ var; ana sayfa aynı mod için 0/2 diyor (sayı tutarsızlığı). |
