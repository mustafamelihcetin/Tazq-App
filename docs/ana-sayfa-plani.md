# Ana Sayfa ve Bağlı Sayfalar Kalite Planı

Tarih: 2026-11-06. Kaynak: [ana-sayfa-analizi.md](ana-sayfa-analizi.md). Tüm fazlar uygulandı (cihazda denenmedi). `index.tsx` 790 satırın altında, durum `useHomeModel`de; model hâlâ 1730 satır, `HomeSheets` yapılmadı.

## Hedef

Şık, minimalist, işlevsel, tatlı. Ölçülebilir karşılıkları:

- **İşlevsel:** Ödemeyi ekranı açmadan hatırlat; yanlış dokunuş tek dokunuşla geri alınsın.
- **Minimalist:** İlk görevin üstünde tek özet katmanı kalsın. Bu turda yeni ayar en çok bir tane.
- **Şık:** Panel içinde kart içinde kart yok; tüm yazılar token ölçeğinde.
- **Tatlı:** Yalnız kullanıcının yaptığı şeye karşılık küçük hareket; kendiliğinden dönen süs yok, Hareketi Azalt açıkken hepsi kapalı.

## Kullanılan repolar

Yıldız ve tarih GitHub API'sinden, kod `git clone --depth 1` ile indirilip okundu; hiçbiri çalıştırılmadı.

| Repo | Yıldız | Commit | Lisans | Okunan kod |
|---|---|---|---|---|
| [jameskokoska/Cashew](https://github.com/jameskokoska/Cashew) | 4.784 | `9cfbe50` | GPL-3.0 | `notificationsSettings.dart`, `navigationFramework.dart`, `upcomingTransactionsFunctions.dart`, `homePage*.dart`, `editHomePage.dart` |
| [tasks/tasks](https://github.com/tasks/tasks) | 5.720 | `0458c11` | GPL-3.0 | `TaskListFragment.kt`, `AlarmService.kt` |
| [iSoron/uhabits](https://github.com/iSoron/uhabits) | 10.394 | `82c1ff2` | GPL-3.0 | `preferences.xml`, `AutoBackup.kt`, içe aktarma dosyaları (adlarıyla) |
| [actualbudget/actual](https://github.com/actualbudget/actual) | 30.012 | `92865f3` | MIT | `shared/schedules.ts`, `StatusBadge.tsx`, `schedules/app.ts` |
| [ellite/Wallos](https://github.com/ellite/Wallos) | 8.798 | `8cc1f5d` | GPL-3.0 | `sendnotifications.php` |
| [bluesky-social/social-app](https://github.com/bluesky-social/social-app) | 18.377 | `842dcf4` | MIT | `PressableScale.tsx`, `CountWheel.tsx`, `GestureActionView.tsx`, `Toast/`, `haptics/` |
| [gunnartorfis/sonner-native-toasts](https://github.com/gunnartorfis/sonner-native-toasts) | 1.363 | `e234de7` | MIT | `constants.ts`, `types.ts`, `package.json` |
| Pomodoist (önceki tur) | 528 | `9260f2e` | AGPL-3.0 | `today_screen.dart`, `task_completion_feedback.dart` |

GPL ve AGPL kodlarından yalnız fikir alınır. MIT kod gerekirse atıfla uyarlanabilir.

**Sınır:** Arama API'si iki sorguda kayda değer sonuç vermedi; adayları bilinen projelerden seçip yıldızlarını API ile doğruladım. Yani bu "objektif en iyi 7" değil, konuya en uygun bulduklarım. React Native'de bütçe uygulaması bulunamadı; Cashew Flutter.

## Repolardan çıkan kararlar

| Konu | Repoda gördüğüm | Bizim kararımız | Bilerek ayrıldığımız yer |
|---|---|---|---|
| Ödeme hatırlatması | Cashew açılışta tümünü iptal edip yeniden kurar | Aynı model, ekrandan bağımsız | Bir yıl ileri değil, en yakın 20 ödeme |
| Ödeme eylemi | Cashew ve Actual: Öde, Atla | Gelen kutusunda Öde; Atla menüde | Cashew her ödemede onay penceresi açıyor; biz doğrudan yapıp geri alma veriyoruz |
| Ödeme durumu | Actual: `missed`, `due`, `upcoming` | Mevcut durumlarımız yeterli | Yeni durum yok |
| Geri alma | Tasks.org 4 sn, tekrar eden görevi ayrı geri alıyor; Pomodoist 7 sn; Actual `undoable` | 6 sn, tekrar eden görev ayrı ele alınır | - |
| Geri alma bildirimi | sonner-native, Bluesky'nin kullandığı | Var olan `useToastStore` geliştirilir | Yeni paket yok: mevcut altyapı eylem destekliyor |
| Ana sayfa | Pomodoist tek özet satırı; Cashew sıralanıp kapatılabilen bölümler | Tek özet katmanı, otomatik sıra | Cashew'un düzenleme ekranı yok: yeni ayar yükü |
| Sayı değişimi | Bluesky `CountWheel`: 400 ms, cubic out, Hareketi Azalt kontrolü | Mevcut `RollingDigits` aynı ölçüye | - |
| Kaydırma eylemi | Bluesky `GestureActionView`: eşikte titreşim, iki kademe | `SwipeableItem` eşikte tek titreşim | İki kademe yok |
| Gün sınırı | Loop: tek anahtar, "Yeni günü 03:00'e kadar bekle" | Aynı tek anahtar | Saat seçici yok |
| Geri yükleme | Loop içe aktarma ve 5 otomatik yedek | Elle içe aktarma, önizlemeli | Otomatik yedek bu turda yok |

## Faz 1: Güven

### 1.1 Ödeme hatırlatması her zaman kurulu (analiz #1)
- **Sorun:** `schedulePaymentDueNotif` yalnız `app/odemeler.tsx:268`.
- **Çözüm:** `features/payments/paymentReminders.ts`, `syncPaymentReminders()`: bizim kimliklerimizi iptal eder, en yakın 20 ödemeyi kurar. Uygulama açılışında, öne gelişte ve ödeme deposu değişince çalışır; ekran koddan çıkar.
- **Kontrol et:** `notifications.ts:981` `cancelAllScheduledNotificationsAsync` hangi akışta çalışıyor; hatırlatmaları silip geri kurmayabilir.
- **Risk:** iOS'un bekleyen bildirim sınırı var (genelde 64 olarak bilinir, belgeyle doğrulayamadım) ve başka bildirimlerimiz de var; bu yüzden üst sınır 20.
- **Bitti:** Ödemeler ekranı hiç açılmadan bildirim kurulur; ödendi işaretinde sonraki dönem kurulur; `-1` hatırlatması olan kurulmaz; testler.

### 1.2 Görevde geri alma (#3)
- **Çözüm:** Görev tamamlanınca "Bitti · Geri al", 6 sn. Toast eylemli olunca süresi uzar; mevcut 4 sn eylemsizlerde kalır.
- **Geri alınacaklar:** görev durumu, sunucu ya da çevrimdışı kuyruk, `useCompletionStore` kaydı, puan. "İlk başarı" damgası geri alınmaz, kutlama tekrar çıkmaz.
- **Risk:** Tasks.org tekrar eden görevi ayrı geri alıyor. Bizde aylık tekrarın tamamlanınca ne yaptığı önce doğrulanacak.
- **Bitti:** Çevrimiçi, çevrimdışı ve sunucu hatasında testler; art arda iki tamamlamada her geri alma kendi görevini döndürür.

### 1.3 Ödeme silmede geri alma (#5)
- **Çözüm:** Onay penceresi yerine anında gizle, 6 sn "Silindi · Geri al", süre dolunca sil. Actual'ın `undoable` fikrinin karşılığı. Uygulama bu sırada kapanırsa ödeme durur: veri kaybı yönünde hata yapılmaz.
- **Bitti:** Bildirim yalnız silme kesinleşince iptal edilir; test.

**Kontrol noktası:** tsc, jest; cihazda bir ödeme bildirimi ve iki geri alma.

## Faz 2: Ana sayfanın üstü (#2, #8)

Kullanıcının çirkin bulduğu kutu buradan çözülür.

**Bugün:** durum şeridi → rota kartı → mod satırları → ayraç → çiçek ve cümle → halkalar → liste.

**Sonra:** durum şeridi → tek özet satırı → çiçek ve cümle → liste.

- **Tek satır:** `TodayRings` panelinin `topSlot` yuvasında. Birden çok hedef varsa "Sıradaki: Aylık birikim tutarını belirle · 2/4", tek hedefte mod satırı. Altında 2 pt ilerleme çizgisi panelin kendi `divider` renginde. Kart ve arka plan yok; `RouteBanner` kartı kalkar.
- **Dokunma:** Rota ya da Modlar'a gider. Mod sayfaları arasındaki kaydırma korunur.
- **Ödeme kartı:** Ana sayfada yalnız gecikmiş ve bugün; 3 günlük pencere gelen kutusunda kalır (#12).
- **Kural:** `ModeDeck` Android'de boşluk hatasına dokunabileceği için (hafızadaki kök neden bilinmiyor) satır kaldırılmaz, içeriği değişir; değişiklikten sonra iki soğuk açılış denenir.
- **Bitti:** `DisplayPanel` içinde kart zemini kalmaz (bekçi testi); açık ve koyu temada ekran görüntüsü; mod yok, 1 mod, 2+ mod durumları test edilir.

## Faz 3: Gelen kutusu ve Ödemeler (#4)

- **Satırda Öde:** Sağda küçük daire. Dokununca tik çizilir, satır kısalarak gider, "Ödendi · Geri al". Değişken tutarlıda mevcut `PaidAmountSheet` açılır.
- **Atla:** Ödemeler'de uzun bas menüsüne "Bu dönemi atla" (Cashew, Actual). Sunucu desteklemiyordu; `LastSkippedCycleKey` ve `POST /api/payments/{id}/skip` eklendi, geçmişe kayıt yazılmaz.
- **Boş kutu:** "Her şey yolunda" ve yavaşça beliren tek yıldız. Durur, dönmez.
- **Kaydırma:** Ödeme satırında eşikte tek titreşim (`SwipeableItem`).

## Faz 4: Tatlı dokunuşlar

Yeni görsel dil yok. Her biri kullanıcı eylemine bağlı, kısa ve durur.

| An | Hareket | Kaynak |
|---|---|---|
| Görev bitince | Daire dolar, tik çizilir, yumuşak titreşim; kalan sayı döner | Bluesky `CountWheel` süresi |
| Ödeme ödenince | Tik, aylık toplam sayarak azalır | Mevcut `AnimatedNumber` |
| Dokunma | Mevcut basış ölçeği korunur; Hareketi Azalt kontrolü eklenir | Bluesky `PressableScale` |
| Gün bitince | Mevcut kutlama, değişmez | - |

Ayrıca titreşim sayısı tavanı aşılmaz; önce gereksiz titreşim bulunup kaldırılır.

## Faz 5: Ayarlar ve Profil (#6, #7, #10, #11)

- **Başlık:** Profil ve Ayarlar aynı adı kullanır (tek sözlük anahtarı).
- **Dil:** `settings.tsx` ve `profile.tsx` satır içi dil koşulları sözlüğe taşınır, `i18nRatchet` sınırı düşürülür. Görünüm değişmez.
- **Geri yükleme:** "Verilerimi indir"in yanına "Yedeği geri yükle". Dosya seçilir, "12 görev, 3 alışkanlık" önizlemesi, onay. Üstüne yazmaz, ekler. Kimliği aynı kayıt tekrar eklenmez. Dosya seçici yüklü `expo-file-system` içinde (`File.pickFileAsync`), yeni paket gerekmedi.
- **Gün sınırı (düzeltildi):** Plandaki varsayım yanlıştı: alışkanlık, odak, spor, momentum, plan ve sınav sayaçları zaten 03:00'te gün değiştiriyordu, kural 14 yerde elle yazılıydı. Anahtar eklenmedi: varsayılan zaten oydu. Kural `shared/utils/appDay.ts`te toplandı, gece yarısı ile 03:00 arasında Kado'daki gibi tek satır not (`RolloverCaption`). Görev vadesi takvim günü kalır (`toDateKey`): "hangi gün olacak" ayrı soru.

## Faz 6: Bakım (#9)

- `app/index.tsx`: durum `useHomeModel` kancasına, açılır yüzeyler `HomeSheets` bileşenine (Pomodoist'in ince ekran ve view model ayrımı). Hedef 1.200 satırın altı, `fileSize` sınırı düşer.
- `docs/ekran-envanteri.md` güncellenir: silinen `FocusWeekStrip` hâlâ yazıyor.

## Ek: Bugün'ün alışkanlıkları (2026-11-06)

Yatay şerit yerine tamamı görünen ızgara ve son 7 gün izi (`HabitTile`). Okunan repolar: scastiel/kado `21bad65` (MIT, `HabitRowView`, `TodayRow`), FriesI23/mhabit `8adc337` (Apache-2.0, `page_today`), ofalvai/HabitBuilder `38ad6b2` (Apache-2.0, `compact/HabitItem`), InlitX/streak `2182edf` (GPL-3.0, `express_habit_card`), xpavle00/Habo `1ddf4c4` (GPL-3.0, `one_day_button`), iSoron/uhabits (GPL-3.0). Kod kopyalanmadı, yalnız fikir alındı.

## Bilerek yapılmayanlar

- **Ana sayfa düzenleme ekranı (Cashew `editHomePage`):** Güçlü ama minimalizme ters; otomatik sıra önce denenir.
- **`sonner-native` paketi:** Temiz ve yalnız JS, ama mevcut toast geri almayı destekliyor; tek özellik için bağımlılık eklenmez.
- **Otomatik yedek (Loop):** Hesaplıda bulut var; misafir için elle dışa ve içe aktarma yeterli başlangıç.
- **Sunucudan ödeme bildirimi (Wallos cron modeli):** Sunucu altyapısı ister; yerel bildirim yeterli.
- **Reef'in açılış diyalogları ve Cashew'un her ödemede onay penceresi.**

## Sıra ve doğrulama

```
Faz 1 → Faz 2 → Faz 3 → Faz 4
          └→ Faz 5 ve Faz 6 bağımsız; gün sınırı en sona
```

Her adım: önce kırmızı test, `tsc`, tam jest. Faz 1, 2 ve 3 sonunda cihazda bakılır; telefon kullanımı için önce sorulur. Commit kullanıcıda. Backend yalnız "Atla" gerektirirse değişir; o zaman yedek, deploy, log, açıklık rutini.

## Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Ana sayfa panelinde Android boş ekran hatası (kök neden bilinmiyor) | Yüksek | Satır kaldırılmaz, iki soğuk açılış denenir |
| Gün sınırı değişikliği seri ve haftalık sayıları bozar | Yüksek | Son faz, tek yardımcı, kapsamlı test |
| Bildirim yeniden kurma mevcut akışla çakışır | Orta | `cancelAll` akışı önce okunur, yalnız ödeme kimlikleri silinir |
| Geri alma puan ve kutlamayla tutarsız kalır | Orta | Tek eylem fonksiyonu, testle |
| Geri yükleme yinelenen kayıt üretir | Orta | Kimlik kontrolü, önizleme, ekleme modu |

## Kararlar (öneriyle)

1. **Ana sayfa satırı:** Yalnız "Sıradaki" ve 2/4; mod satırı tek hedefte. Öneri: bu.
2. **Gün sınırı:** Ayrı turda yapılsın. Öneri: bu, en riskli madde.
3. **Geri yükleme:** Yeni paket gerekiyorsa sonraki derlemeye kalsın. Öneri: bu.
