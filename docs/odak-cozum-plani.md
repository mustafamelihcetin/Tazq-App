# Odak Sayfaları Çözüm Planı (v2)

**Durum (2026-11-06):** Faz 0-5 uygulandı, sunucu canlıda. Açık: cihazda ölçüm ve doğrulama (1.3), Maestro akışı çalıştırılmadı (1.4), Faz 6 sonraki yerel derlemeye bekliyor, `app/focus.tsx` 2.206 satır (hedef 1.200'e ulaşmadı).

Tarih: 2026-11-06. Kaynak: [odak-analizi.md](odak-analizi.md) (19 eksik; numaralar aynı).
v2, ilk taslağın kararlarını repoların kodundaki gerçek çözümlerle sınar. Yalnız fikir alınır, kod kopyalanmaz (lisans notu analizde).

## Tasarım ilkeleri

1. **Ekran kalabalıklaşmaz.** Yeni bir şey eklenirse aynı ekrandan bir şey kalkar.
2. **Ayar yerine çıkarım.** Yeni açma kapama düğmesi yok; davranış bağlamdan anlaşılır.
3. **Yeni kavram yok.** Görev zaten etikettir; mevcut kadran, özet ve yakalama motoru kullanılır.
4. **Yargılama yok.** Eksik değil kazanılan gösterilir; ceza dili yok.
5. **Odak akışı kesilmez.** Uygulama kullanıcıyı durdurmaz, kullanıcı durunca konuşur.

## Repoları okuyunca değişen kararlar

| Konu | İlk taslak | Repodaki kanıt | Yeni karar |
|---|---|---|---|
| Süre dolunca (7) | +5 dk yeter | GoodTime `FinishedSessionContent`: alarmdan sonra geçen süre "ek odak" olarak eklenebilir | Özette "+4 dk ekle" seçeneği; Zen'de özet kendiliğinden fırlamaz |
| Kesinti (15) | Yapılmıyor | GoodTime `FinishedSessionFactory`: `timeSpentPaused` seansla saklanır | Saklanır, yalnız olumlu gösterilir: ışıltılı yıldız = kesintisiz seans |
| Katı mod (3) | Saat durur | Reef `FocusModeService`: katı modda duraklatma yok; Pomodoist `allowPause` | Katı modda duraklat düğmesi kalkar, ayrılınca saat kendisi durur |
| Dönüş anı (3) | Yazı | Reef `MindfulLaunchActivity`: geçişte nefes ve bekleme | Dönüşte kısa nefes anı, sonra sayaç kendisi devam eder |
| Mola (6) | Süre ÷ 5, tek seferlik | GoodTime `BreakBudgetData`, Reef `breakBudget`: bütçe birikir, molada azalır | Kalıcı mola bütçesi; artan süre kaybolmaz |
| Kayan süre (performans) | Yok | FocusTide `adaptiveTickingMultipliers`: görünmezken güncelleme seyrekleşir | Zen'de ve arka planda sayaç saniyede bir çizilmez |
| Görev ile süre (4) | Yalnız ad | Tomato `Topic`: her konunun kendi süresi var | Görev seçince kadran o görevin son süresine gelir |
| Rahatsız Etmeyin (19) | Sonraya, ayrı | Tomato `dndEnabled`, izin ekranı ve `setInterruptionFilter` | Katı moda bağlanır, ayrı düğme yok; önceki hal geri yüklenir |

## Karar özeti

| # | Eksik | Çözüm |
|---|---|---|
| 1 | Dünya sıfırlanıyor | Koşu modeli: uzatma ve Pomodoro turları aynı dünyayı büyütür |
| 2 | Pomodoro özeti | Tur arasında yok, döngü sonunda ve erken bitirişte koşu toplamıyla var |
| 3 | Katı mod | Duraklat yok, ayrılınca saat durur, dönüşte nefes anı; seans asla kendiliğinden bitmez |
| 4 | Ne için odaklanıldı | Görev adı kaydedilir, gökyüzünde görünür, kadran görevin süresini hatırlar |
| 5 | Akla gelen şey | Seans içinde tek satır not; seans sonunda görev önerisi olur |
| 6 | Serbest süre | Kadranın son durağı "Serbest"; kalıcı mola bütçesi |
| 7 | Süre dolunca | Özette +N dk ekle ve +5 dk; Zen'de bitiş sessizce bekler |
| 8 | Not | Görevsiz seansta "Neye odaklandın?", isteğe bağlı |
| 9 | Kalabalık ekran | 9 bölgeden 6'ya |
| 10 | Okunurluk | İpucu öğrenilince kalkar, kontrast ölçülür ve teste bağlanır |
| 11 | Sesler | Tek çip, yerinde açılır, sahnenin sesi önde |
| 12 | Pil | Dokunulmazsa kararma, Zen'de seyrek sayaç |
| 13 | Ölçüm | Cihazda, eşikli |
| 14 | Kapatma testi | Maestro; saat değişimi testi |
| 15 | Kesinti | Saklanır; ışıltı kesintisiz seansı anlatır |
| 16 | `focus.tsx` | Dokunulan parça o fazda çıkarılır |
| 17 | Fazla dosyalar | Onayla silinir |
| 18 | Puanlama | Geri gelmez |
| 19 | Rahatsız Etmeyin | Yeni derlemede Android; katı moda bağlı |

## Faz 0: Hatalar ve güvenlik ağı

### 0.1 Sahne derleme bekçisi
- Jest içinde `canvaskit-wasm` ile dört sahneyi ve hafif sürümlerini derleyen test.
- **Bitti:** Bilerek bozulan shader testi kırıyor.

### 0.2 Koşu modeli (1)
- Depoya `run: { doneSeconds, plannedSeconds }`. `worldFor` koşuyu okur. `extendSession(minutes)` görevi ve dünyayı korur, yeni kayıt açar. Pomodoro'da plan `4 × çalışma`, mola dünyayı dondurur. Koşu; Yeni Seans, Ana Sayfa ve sıfırlamayla biter.
- **Dosyalar:** `useFocusStore.ts`, `focusScenes.ts`, `useSceneWorld.ts`, `SessionSummary.tsx`.
- **Önce test:** 25 + 5 dk'da büyüme düşmez, parçalar sürer; Pomodoro 2. turda dünya kaldığı yerden başlar; kapanıp açılınca korunur; eski kayıtlı durumda `run` yoksa güvenli açılır.

### 0.3 Pomodoro özeti (2)
- Tur aralarında geçiş yazısı ve yeni parça. Dördüncü turda ve erken bitirişte `SessionSummary`, koşu toplamıyla.
- Tamamlama akışı `useSessionCompletion` kancasına taşınır (16).
- **Bitti:** Tur arasında pencere yok, sonda bir kez var, kayıt tekrarı yok.

### 0.4 Katı mod (3)
- **Bulgu:** React Native belgesine göre gelen arama iOS'ta `inactive` yapar; biz yalnız `background`'a tepki veriyoruz, yani çalma anı sorun değil. Aramayı açmak, kilit ve başka uygulama `background` olabilir ve yerel kod olmadan ayırt edilemez. Bu yüzden ayrım gerektirmeyen kural seçildi.
- **Kural:** Katı modda duraklat düğmesi yok. 10 saniyeyi aşan ayrılıkta seans bitmez; kalan süre ayrılış anında donar, ayrı geçen süre sayılmaz.
- **Dönüş:** Tam ekran kısa nefes anı (3 sn, "Geri geldin"), sonra sayaç kendisi devam eder. Dokununca atlanır. Hareket azaltmada yalnız yazı.
- **Metin:** "10 sn+ ayrılırsan saat durur"; bildirim "10 saniye içinde dönmezsen saat durur".
- **Dosyalar:** `session.ts`, `app/focus.tsx`, `_layout.tsx`, yeni `ReturnBreath.tsx`.
- **Önce test:** 11 sn ayrılık kayıt açmaz ve kalan süre doğru; 9 sn ayrılıkta etkisiz; katı modda duraklat görünmez.

**Kontrol noktası:** tsc, tam jest; elle Pomodoro iki tur, 25 + 5, katı modda çık dön.

## Faz 1: Performans gerçeği

Sonraki fazlar bu sonuca göre şekillenir.

### 1.1 Seyrek sayaç (12)
- `CountdownText` ve `ProgressDriver` saniyede bir mağazayı okuyor, Zen'de görünmezken de. Zen'de ve arka planda saniyelik abonelik kesilir; yörünge 30 sn'de bir güncellenir.
- **Bitti:** Zen'de render sayacı testi; Zen'den çıkınca sayaç anında doğru.

### 1.2 Dokunulmayınca dinlenme (12)
- Tam ekran sahnede 10 dk dokunuş yoksa siyah katman 60 sn'de %65'e çıkar, kare 12'ye iner. İlk dokunuş ışığı döndürür, düğmeye basmaz. Sayaç ve kayıt etkilenmez.
- **Dosyalar:** yeni `useIdleDim.ts`, `FocusBackdrop.tsx`.

### 1.3 Ölçüm (13)
- Önceki commit'e karşı 25 dk Zen: pil, ısı, kare. Android'de `dumpsys batterystats` ve `gfxinfo`, iPhone'da pil yüzdesi. Telefon için önce sorulur.
- **Eşik:** Eski sürümden çok tüketmemeli; zayıf Android'de takılma olmamalı.
- **Aşılırsa sırayla:** yoğunluk 1.25x, kare 20, Sis'te ağaç sırası azaltma.

### 1.4 Dayanıklılık (14)
- Maestro: 1 dk seans, kapat, aç, tek kayıt. `clearState` yok.
- Birim: Cihaz saati geri alınırsa kalan süre negatif ya da fazla olmaz (GoodTime monotonik saat kullanıyor, biz duvar saati).

## Faz 2: Seansın izi

Ürünün en büyük kazancı. Backend ve bir migration içerir; yedek, deploy, log, check-exposure rutini bende.

### 2.1 Sunucu sözleşmesi (4, 7, 15)
- `FocusSession` alanına `PausedSeconds` (varsayılan null: eski kayıt bilinmiyor).
- `/api/focus/save`: isteğe bağlı `pausedSeconds`; oluşan kimliği döndürür.
- `/api/focus/sessions`: `Id`, çözülmüş `TaskName` (`'Focus'` ise boş), `Completed`, `PausedSeconds`.
- `PATCH /api/focus/sessions/{id}`: ad ve ek dakika; ek dakika en çok 60, yalnız sahibi. Şifreleme ve 200 karakter sınırı aynı.
- Eski istemci bozulmaz. **Önce test:** başkasının seansı değişmez, başkasına görünmez, ad şifreli yazılır.

### 2.2 İstemci kaydı (4)
- `commitFocusSession` görev adını ve duraklatma süresini gönderir; kuyruk da aynı.
- Görevsiz seans `'Focus'` kalır. Geçmiş mağazası yeni alanları taşır.

### 2.3 Gökyüzünde anlam (4, 15)
- Toplamın altında: "En çok: Tez · 1 sa 40 dk". Güne dokununca dökümde en çok 3 satır ad ve süre. Hiç ad yoksa satır yok.
- **Işıltı haçı artık süre değil anlam:** kesintisiz seans. Eski kayıtlar için bugünkü süre kuralı kalır. Lejant: "ışıltılısı kesintisiz". Ceza dili ve sayı yok.

### 2.4 Görev süreyi hatırlar (4)
- Görev seçince kadran o görevin son süresine yumuşakça gider; yoksa dokunmaz. Yerel, yeni ayar yok.

### 2.5 Bitiş akışı (7, 8)
- **Zen'de:** Süre dolunca çan çalar, kayıt hemen yapılır, özet ilk dokunuşa kadar bekler; sahne sürer. Odaktaki kişi bölünmez.
- **Özette:** Alarmın üstünden en az 1 dk geçtiyse sessiz seçenek "+4 dk ekle", varsayılan kapalı. Üst sınır 60. Yalnız kullanıcı isterse sayılır.
- **Görevsiz seans:** "Neye odaklandın?" tek satır, boş geçilebilir. Görev sorusuyla aynı anda çıkmaz.
- Seans kuyruktaysa değişiklik kuyruğa yazılır; gönderildiyse `PATCH`.
- **Risk:** Klavye ve küçük ekran; pencere zaten kayıyor, test edilir.

**Kontrol noktası:** deploy rutini, canlıda seans, gökyüzünde ad ve ışıltı.

## Faz 3: Akla gelen şey (5)

- **Giriş:** Seans sürerken kontrol satırında kalem. Tek satır, sahne görünür kalır; gönder ya da aşağı kaydır kapatır. Zen'de önce dokunup kontrolleri getirmek yeter.
- **Davranış:** Yazı hemen göreve dönüşmez (Pomodoist'ten bilerek ayrılıyoruz: liste açmak odağı böler). Tost yok; kalem kısa süre dolu görünür.
- **Sonuç:** Özette "2 not bıraktın". Dokununca `features/tasks/nlp/capture.ts` görev önerir; tek dokunuşla eklenir ya da silinir. Karar verilmeyen not sonraki özette yine çıkar.
- **Depolama:** Cihazda kalıcı, sunucuya gitmez.
- **Önce test:** Sıfırlamada ve kapanışta kaybolmaz; 600 karakter sınırı; klavye açıkken saat çalışır, katı mod tetiklenmez.
- **Dosyalar:** yeni `SessionNote.tsx`, `SessionNotesReview.tsx`, `useFocusStore.ts`.

## Faz 4: Serbest süre (6)

En riskli faz; tek saat modeline dokunur, koşu modeli üstüne kurulur.

- **Giriş:** Kadranın 120'den sonraki son durağı "Serbest". Pomodoro açıkken yok. Yeni düğme yok.
- **Saat:** Başlangıç anı ve toplam duraklatma; süre tikten değil saatten. Kayıt kilidi aynı.
- **Halka:** Dolmaz, ince ışık yavaşça döner. **Dünya:** 60 dk'da tamamlanır, parçalar 5 dk'da bir.
- **Mola bütçesi:** Odakta birikir (süre ÷ 5, ayar yok), molada azalır, artan bütçe aynı gün içinde kalır, en çok 30 dk, gün değişince sıfırlanır. Bütçe sıfırsa bile kullanıcı mola alabilir; engellemeyiz.
- **Bitiş:** Kullanıcı bitirir, tamamlanmış sayılır. Özette ana düğme "12 dk mola". Erken dönerse kalan bütçede kalır.
- **Güvenlik:** 4 saatte kendiliğinden biter ve kaydedilir.
- **Canlı etkinlik, ada, bildirim:** Yukarı sayım; süre dolumu bildirimi yok.
- **Önce test:** Saat atlamaz, kapanıp açılınca sürer, kayıt bir kez, bütçe hesabı ve gün değişimi, 4 saat sınırı.
- **Dosyalar:** `useFocusStore.ts`, `DurationDial.tsx`, `session.ts`, `liveActivity.ts`, `FocusIsland.tsx`.

**Kontrol noktası:** Canlı etkinlik cihazda; yerel taraf yeni derleme isterse burada durup sorarım.

## Faz 5: Sadeleşme (9, 10, 11)

Yeni özellikler yerleştikten sonra, gerçek içerikle.

| Bölge | Bugün | Sonra |
|---|---|---|
| Üst | Kapat, başlık rozeti, gökyüzü | Aynı |
| Hafta şeridi ve seri | Çubuklar ve yazı | Tek satır "Bugün 38 / 45 dk"; dokununca gökyüzü |
| Ortada | Top, kadran, süre, ipucu, görev | İpucu ilk kullanımdan sonra kalkar |
| Kontroller | Nefes, başlat, modlar | Aynı |
| Sesler | 9 çipli kayan satır | Tek çip "Okyanus"; dokununca yerinde açılır, sahnenin sesi ilk sırada |
| Alt | Söz satırı | Karar 1 |

- **Okunurluk:** Beyaz yazılar dört sahnede ölçülür, en az 4.5:1. Ölçüm 0.1'deki bekçiye eklenir, sahne değişince test uyarır. Sabit `fontSize` değerleri F ölçeğine alınır.
- **Nefes:** Siyah bantlar kalkar; seçicideki küre büyüyerek ortaya oturur, kenar ışığı nefesle açılıp kapanır. Kurulum sahnesindeki bantlar da kalkar.
- **Bitti:** Boş ekranda 6 bölge; küçük telefonda kaydırma yok; tasarım bekçileri geçer.

## Faz 6: Yerel derleme (19)

Bir sonraki planlı derlemeyle; tek başına derleme harcatmaz.

- **Android:** Yerel modül `setInterruptionFilter`. Katı mod açılınca izin ekranına götürür; izin yoksa katı mod yine çalışır. Seans başında önceki hal kaydedilir, bitişte ve uygulama yeniden açıldığında geri yüklenir; kullanıcının telefonu sessizde kalmaz.
- **iOS:** Uygulamanın Odak modunu açtırma imkânı yok; yapılmaz.

## Sürekli işler

- **16:** Çıkarılacaklar: `useSessionCompletion`, `FocusControls`, `AmbientChip`, `FocusHeader`. Hedef 1.200 satırın altı; `fileSize` sınırı her fazda düşer.
- **17:** `LightsCollected.tsx`, `celebrationLottie.ts`, kullanılmayan koç metinleri onayla silinir.

## Sıra

```
Faz 0 ─┬─ Faz 1
       ├─ Faz 2 ─ Faz 3 ─┐
       └─ Faz 4 ─────────┴─ Faz 5 ─ (Faz 6 sonraki derlemede)
```

Her adım ayrı, gözden geçirilebilir bir fark bırakır. Önce kırmızı test, sonra kod. Commit kullanıcıda.

## Bilerek yapılmayanlar

- **Uygulama engelleme:** Reef bunu Android erişilebilirlik servisiyle (`BlockerService`), iOS'ta ise Screen Time izniyle yapmak gerekir. Yerel kod ve mağaza incelemesi riski taşır; katı mod ve Rahatsız Etmeyin önce denenir.
- **Sahte seans denetimi, puan, sıralama:** Gerçek kullanıcıyı cezalandırır, kazancı yok.
- **Mola oranı, etiket renkleri gibi ayarlar:** İlke 2 ve 3.

## Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Koşu ve serbest süre tek saat modelini bozar | Yüksek | Önce test; serbest mod ayrı dal, kayıt kilidi ortak |
| Zen'de özetin beklemesi kaydı geciktirir | Orta | Kayıt alarm anında yapılır, özet yalnız görünümdür |
| Sahneler ölçümde ağır çıkar | Orta | Faz 1 erken; kademeli düşürme hazır |
| Görev adı gizliliği | Orta | Alan şifreli, yanıt yalnız sahibine, loglara yazılmaz; `check-exposure` |
| Rahatsız Etmeyin açık kalır | Orta | Önceki hal kaydı, açılışta geri yükleme |
| Canlı etkinlik yukarı sayıma uymaz | Orta | Faz 4 kontrol noktası; gerekirse yalnız ada |

## Kararlar (öneriyle)

1. **Söz satırı:** ~~Boş ekranda kalkar, seans başında bir kez görünüp söner.~~ Geri alındı (2026-11-06, kullanıcı: "neden kaldırdın"): satır her zaman görünür, 40 sn'de bir değişir; yalnız Zen'de seans sürerken gizli.
2. **Katı mod:** Seans kendiliğinden bitmez, saat durur. Öneri: bu. Hayır denirse madde 3 yerel kod ister.
3. **Puanlama:** Geri gelmez. Öneri: bu.
4. **Sil:** Madde 17'deki dosyalar. Öneri: sil.
