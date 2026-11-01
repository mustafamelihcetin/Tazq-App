# Tazq yeniden düzenleme planı — v2 (2026-10-31)

v1'in iskeleti korunur (A organizasyon, B canlılık, C ilk dakika). Bu sürüm koda karşı doğrulandı;
değişiklikler **kalın** ve her birinin gerekçesi kodda ölçülen bir bulguya dayanır.

Kaynaklar: `planning-and-task-breakdown` (bağımlılık grafiği, dikey dilim, kontrol noktası),
`doubt-driven-development` (her maddeye "neyle kırılır?"), marketingskills `onboarding`
(aktivasyon tanımı, time-to-value), proje hafızası (animasyon dili, tur kuralları, Anlama Motoru ilkeleri).

## Her adımın kuralları (v1 + iki ek)

1. Önce test (kırmızı), sonra kod.
2. `tsc` + tüm testler (Metro açıksa `--maxWorkers=2`).
3. Telefon yalnız sorduktan sonra; commit yok.
4. **Her adım ayrı, gözden geçirilebilir bir fark bırakır** — sen commit'lersin, sonraki adım ona oturur (geri alma noktası).
5. **Her adımın "bitti" tanımı yazılıdır**: hangi test, hangi davranış, hangi ekranda neye bakılır.

## Koddan çıkan beş bulgu (planı değiştiren)

| # | Bulgu | Planı nasıl değiştiriyor |
|---|---|---|
| K1 | `shared/utils/planExtractor.ts` kelime içinde arıyor (`s.includes(kw)`). Ölçüldü: "okula git" → **Okuma alışkanlığı**, "dilekçe yaz" → **Yazı Yazmak alışkanlığı**, "pazartesi, çarşamba ve cuma spor" → "Pazartesi", "Çarşamba", "Cuma spor" diye **üç görev**; "Yarın sunumu bitir" başlığında "Yarın" kalıyor, tarih hiç atanmıyor; EN başlık = TR başlık. | C1 bu çıkarıcının üstüne **kurulamaz**. Bölme + sınıflama Anlama Motoru'nun (`features/tasks/nlp`, kök+ek eşleşmesi, metni tüketen çıkarıcılar) üstüne yeniden yazılır. Eski çıkarıcının tek kullanıcısı `TurkishModeBanner` (satır 781) da sonra yenisine geçer → tek ayrıştırıcı. |
| K2 | `Understanding` tek `recurrenceDay` taşıyor; çok günlü tekrar yok. Alışkanlık v2 ise sıklık destekliyor. | C1'e **gün listesi** ("pzt, çar ve cuma") eklenir; virgül/"ve" gün listesinin içinde bölmez. Bu, Anlama Motoru'na küçük, korpus testli bir ek demek (127 satırlık korpus %100 kalmalı). |
| K3 | `shared/utils/analytics.ts` → `track()` yalnız **Sentry breadcrumb** yazıyor. Breadcrumb yalnız bir hata olayına eklenince görünür; sayılamaz. | C6'daki "kaç kişi yazdı/atladı/kaç madde" bu altyapıyla **ölçülemez**. Bkz. C0. |
| K4 | B6'nın yarısı zaten yapıldı: `Touchable` boyuta göre basılma (0.96/0.98, 150 ms), `haptics.ts` anlamsal API. | B6 "yap" değil **"denetle + mandal"** olur: ham `Pressable`/`TouchableOpacity` ve ham `Haptics.*` çağrılarını sayan, sayının artmasını engelleyen test. |
| K5 | Rol ayrımı kısmen yapılmış ve kod yorumlarında yazılı: Rapor = geçmiş, Kokpit = bu hafta, Mod özeti = geri, `gun.tsx` = günün saat ekseni. Ama makinece denetlenmiyor. | A1 sıfırdan değil, **mevcut rol yorumlarının doğrulanması** olarak başlar; A2'nin testi bu yorumları kayda dönüştürür. |

## Yeni sıra

```
A1 ─┐                      (ikisi de koda dokunmaz/saf; paralel)
C1 ─┤
    ├─ A2 → A4 → A3 (adım adım, senin onayınla)
    ├─ C0 (ölçüm + akış kararı) → C2 → C3 → C4 → C5 → C6
    └─ B1 → B2 → B3 ──── kontrol noktası ──── A5, B4, B5, B6
```

v1'den farkı: **A4, C2'den önce** (tanıtım ve turlar yeni sekme adlarıyla bir kez yazılsın, iki kez değil);
**C0 eklendi ve C2'nin önüne alındı** (neyin kaldırılacağı, neyin ekleneceğini belirler; ölçüm değişiklikten önce açılmalı ki karşılaştırılacak bir "önce" olsun).

### Kontrol noktaları
- **KN1 (A1+C1 sonrası):** kopya tablosu senin kararınla işaretli; altın set yeşil. → A3 ve C2 başlayabilir.
- **KN2 (C5 sonrası):** Maestro akışı: kayıt → yaz → önizle → ekle → ana sayfa kendi maddelerinle. Telefonda bir kez (sorarak).
- **KN3 (B3 sonrası):** saniyelik render yalıtımı ölçümü (render sayacı testi) bozulmadı.

---

## A. Organizasyon: her sorunun tek sahibi

| # | İş | Bitti tanımı / v2 eki |
|---|---|---|
| A1 | Ekran envanteri. Her ekran/kart → Bugün / Bu hafta / Hedefler / Geçmiş. | Kopya tablosu + öneri (kalır / bağlantıya döner / silinir). **Ek:** her kart için "nereden açılıyor?" sütunu — bildirim yönlendirmeleri (`_layout.tsx` → `/gun`), tur adımları, derin bağlantılar. Silinecek bir kartın bu girişleri ölü bağlantı bırakmamalı. |
| A2 | Sahiplik kuralı. | **Testin somut biçimi:** `shared/constants/screenOwnership.ts` — her kart bileşeni → tek soru; her ekran → sahip olduğu soru. Kılavuz testi ekran dosyalarının import'larını tarar: başka sorunun kartını içeren ekran kırılır; istisna yalnız `*Link` bileşenleri (tek satır bağlantı). Mevcut rol yorumları (K5) kayda taşınır. |
| A3 | Kopyaları kaldırma, her biri ayrı adım + onay. | **Ek risk:** tur adımı silinirse `TourFeaturePreview` içindeki `case 'dashboard-N'` index'e dayalı eşleme kayar → tur adımı silinmez, yerine "bağlantıya döner"; silmek gerekiyorsa eşleme kimliğe çevrilir (ayrı adım). |
| A4 | Sekmeler: Bugün · Görevler · Odak · Hafta · Hedefler. | `BottomNavBar` `TAB_SHORT` + `TAB_LABELS` (ekran okuyucu tam adı: "Derin Odak", "Yaşam Modları" kararı yeniden düşünülmeli — tanıtımda duyulan adla aynı olma kuralı var). **Çakışma:** "Bugün" sekmesi ile `gun.tsx` başlığı "Bugün" aynı adı alır → Gün ekranının başlığı "Günün saatleri" gibi ayrışmalı. "Hedefler" = Modlar, adlandırma kararıyla (hedef yalnız Modlar'ın uzun vadeli hedefleri) uyumlu. |
| A5 | Başlık düğmeleri sahibine götürür. | Değişmedi; A2'nin kaydını kullanır (düğme hedefi = başka sorunun sahibi). |

## B. Canlılık

Ortak ilke aynen: bilgi taşır, bir kez oynar, durur; `useReduceMotion` açıksa durağan.
**Ek ilke:** ekran okuyucuya ara değer okunmaz, yalnız son değer (akan sayılarda `accessibilityLabel` sabit son değer).

| # | İş | v2 eki |
|---|---|---|
| B1 | Etki hesabı — tek saf fonksiyon. | Girdi: tamamlanan iş + o anki mağaza anlık görüntüsü; çıktı: `{ modeId?, dayProgress: {before, after}, momentum: {before, after} }`. Geri alma (tamamlanmamışa dönüş) aynı fonksiyonla ters yönde → "−1" ve halka geri. Test: plan etiketli görev, etiketsiz görev, alışkanlık, geri alma, yerel gün sınırı (gece yarısı). |
| B2 | Anında "+1" ve halka. | Çip yoksa (aktif mod yok) hiçbir şey çıkmaz; "+1" yalnız ait olduğu yerde. Yeni bir uyanış sinyali icat edilmez — `useWakeSignal` + `CompletionBurst` dili kullanılır. |
| B3 | Sekmeler arası süreklilik. | "Son görülen değer" **oturum belleğinde** (diske değil): diske yazılırsa ertesi günün açılışında dünkü değerden akış yanlış bir "değişim" anlatır. `AnimatedNumber`/`RollingDigits` genişletilir, yeni bileşen yok. Değer değişmediyse oynamaz (uyanış dersi: "değişim yokken değişti deme"). |
| B4 | Günün saati tonu. | **Sınır:** panel zemini kartlarla aynı kalmalı (önceki geri bildirim: "diğer kutularla uyumlu değil"). Ton yalnız durum şeridinde ince bir vurgu çizgisi/glifte; zemin değişmez. |
| B5 | "Sen yokken" satırı. | Açılıştaki 4 sn selamın **yerine** geçer (üst üste binmez). Kaynak: son açılış zamanı (yerel). Hesap saf fonksiyon: `awaySentence(lastOpen, now, modes, tasks)`; 2 günden az → null. Sayı "gecikmiş" değil "bekliyor" (Zen ilkesi, suçlamaz). |
| B6 | Dokunuş tutarlılığı. | K4: denetim + mandal testi. Ham basılabilir ve ham titreşim sayısı yalnız azalabilir. |

## C. İlk dakika: "Aklındakileri yaz"

**Aktivasyon tanımı (eklendi):** başarı "kaç madde ekledi" değil, **eklediği maddelerden birini ilk 24 saatte tamamladı mı**. Mevcut `first_task_completed` olayı bunun yarısı.

| # | İş | v2 ayrıntı |
|---|---|---|
| **C0** | **Ölçüm ve akış kararı (yeni, C2'den önce).** | (1) K3 yüzünden sayılabilir ölçüm yok. Öneri: tanıtım sonucu (`wrote`, `skipped`, `itemCount`, `modeSuggested/accepted`) zaten bulutla eşitlenen `User.Preferences` JSON'una yazılır; admin `AnalyticsService` yalnız toplam verir (analiz dışı kullanıcı kuralına uyar). Yeni servis, ücret yok, metin yok. Misafirler sayılmaz — bu bilinçli bir kör nokta. (2) Mevcut 4 slayt + "neyle uğraşıyorsun" + sade mod sorusu + hoş geldin + tur + bildirim izni için hangisi kalır kararı **burada** verilir; C6 yalnız uygular. |
| C1 | Çoklu ayrıştırıcı (saf). | `features/tasks/nlp/capture.ts`. Bölme: cümle sonu, satır, madde işareti; virgül/"ve" yalnız iki tarafta da bağımsız bir iş varsa ve gün listesi içinde değilse (K2). Her parça → `understand()`; başlık `titleOf()` ile tarih/saat sözcüklerinden arınır. Sınıf: tekrar kanıtı → alışkanlık, yoksa görev; kanıtın kendisi (`facts`) önizlemede gösterilir. Mod sinyali Anlama Motoru'nun kök+ek eşleşmesiyle; **mod tarihi de yakalanır** ("sınavım 12 aralıkta") → C4'te sınav modu tarihsiz değil, tarihle önerilebilir (bugün `quickStart.ts` sınav/tez/mülakatı sıfır girdiyle kuramadığı için ana ekrana atıyor). Üst sınır (ör. 12 madde) + aynı başlığı birleştirme. **Altın set ≥40, TR+EN, ve K1'deki tuzaklar zorunlu satır:** "okula git", "dilekçe yaz", "pazartesi, çarşamba ve cuma spor", "kitap okuma ve not alma", "annemi ara" / "araba muayenesi". Mevcut 127 satırlık korpus %100 kalır. |
| C2 | Giriş ekranı. | Tek alan + 3 örnek cümle + "Atla". Canlı çipler `PillSentence`/mevcut çip dilinden. Yazarken ayrıştırma debounce'lu ve ana iş parçacığını tutmaz (uzun metin testi). |
| C3 | "Şunları anladım". | Her kart: düzelt, çıkar, **görev ↔ alışkanlık değiştir** (en olası yanlış anlama). "Planıma ekle" görevler için mevcut `quickStart.createSeedTask` yolunu kullanır (misafir + çevrimdışı kuyruk zaten doğru); alışkanlıklar için aynı kalıpta tek yardımcı. |
| C4 | Mod önerisi. | Tek satır, atlanabilir; C1 tarih bulduysa "12 Aralık'taki sınavın için sınav modunu açalım mı?" — kabul edilince mod tarihiyle kurulur. Tarih yoksa bugünkü gibi yalnız mod açılır. |
| C5 | Varış. | **Çakışma:** ana sayfa turu ilk ziyarette açılır ve tur açıkken `EntranceStage` kapalıdır (%0 kayma kuralı). Karar gerekir: akış animasyonu → bitince tur, ya da tur ertelenir. Öneri: akış (tek seferlik, ≤600 ms) bitince tur; `useTourGate` bunu bekler. Kullanıcının gerçek verisi olduğu için örnek veri (`useDemoGate`) zaten görünmez — test edilmeli. |
| C6 | Birleştirme. | C0'daki kararı uygular; misafir + çevrimdışı akış testleri; i18n mandalları (TR/EN tüm yeni metinler). Maestro akışı `kayit-yaz-ekle.yaml` (ClaudeKit maestro CLI). |

## Riskler (v1 + yeni)

| Risk | Önlem |
|---|---|
| A3: yanlış kopyayı silmek | Her silme ayrı adım + onay (v1). A1'deki "nereden açılıyor" sütunu ölü bağlantıyı önceden gösterir. |
| A3: tur eşlemesinin kayması | Tur adımı silinmez ya da önce kimliğe dayalı eşlemeye geçilir. |
| A4: ad değişikliğinin sızıntısı | Tur metinleri, `tourPreview` testi (başka ekranın adını yazmama), ekran okuyucu adları, mağaza ekran görüntüsü metinleri (`docs/magaza-listeleme.md`) birlikte. |
| B2–B3: performans | Saniyelik render yalıtımı; son değer `ref`/oturum deposunda, sekme değişiminde yalnız değişen bileşen render olur (render sayacı testi). |
| B4: görsel uyumsuzluk | Zemin değişmez; yalnız vurgu. |
| C1: yanlış anlama | Önizleme zorunlu + görev↔alışkanlık anahtarı + altın set tuzak satırları. |
| C: tanıtım uzar | C0'da en az bir mevcut adım kaldırılmadan C2 eklenmez (adım sayısı artmaz kuralı). |
| C: ölçemeden değiştirmek | C0 ölçümü C2'den önce açık. |

## Senin kararın gereken açık sorular

1. **C0 ölçüm:** tanıtım sonucunu `User.Preferences` üzerinden toplamak uygun mu (metin yok, yalnız sayı/enum)?
2. **A4:** ekran okuyucu tam adları da değişsin mi ("Yaşam Modları" → "Hedefler")?
3. **C5:** varış animasyonu mu önce, tur mu?
4. **C6:** 4 slayttan hangileri kalsın? (C0'da sorulur.)

---

## Kalan adımlar — uygulama sırası (2026-10-31)

Biten: A1, A2, A3 (K-1/K-2/K-3), A4, C1, "Yedek al" düzeltmesi.
Her adım: önce test (kırmızı) → kod → `tsc` + tüm testler → gerekirse telefonda ekran görüntüsü → "neydi → ne yaptım" tablosu.

### Faz 1 · Tek doğru sayı (önce gelir: B1 de aynı sayma motoruna dayanacak)
| # | Adım | Bitti tanımı |
|---|---|---|
| 1 | **Y-1 Sayı tutarsızlığı.** Ana sayfa (`planProgress`, yalnız plan görevleri → 0/2) ile Hedefler (`modlar.tsx mkToday`, görev + alışkanlık → 0/3) ayrı sayıyor. Tek saf fonksiyon: "modun bugünü" = plan görevleri + plan alışkanlıkları; iki ekran onu çağırır, etiket "plan işi" olur. | Aynı veriyle iki ekran aynı sayıyı verir (test); telefonda 0/3 = 0/3 |
| 2 | **Y-2 Hedefler'de üç kez "bugün".** Sol üst hap + bugünün planı satırı + mod kartı çubuğu. Satır kalır (Bugün'e bağlantı); hap ve mod kartındaki "Bugün" çubuğu çıkar ya da mod kartı yalnız kendi modunun yolunu gösterir. | `screenOwnership` testine "Hedefler'de bugün tek yerde" kuralı; telefonda kontrol |

### Faz 2 · Yönlendirme (başlık düğmeleri ve eksik bağlantılar)
| # | Adım | Bitti tanımı |
|---|---|---|
| 3 | **A5 + E-1 + E-3** Her ekranın başlık düğmeleri sahip olmadığı soruya götürür. Ana sayfa: Bu Hafta (var) + **Gün ekranı** (E-1, şu an hiç yolu yok). | Başlık hedefleri kayıttan (A2) test edilir |
| 4 | **E-2** Rapor → "Modların geçmişi ›" (Mod özeti). | Test + telefon |
| 5 | **K-4** Rapor içinde bulunulan haftada "Bu hafta › Hafta" bağlantısı. | Test |
| 6 | **D-2** `index.tsx`'teki önceden kalma sahipsiz yorum + kullanılmayan `topTask` (yalnız onay gelirse). | tsc + test |

**KN-A:** Faz 1–2 telefonda tek turda gezilir (Bugün → Hafta → Rapor → Mod özeti → Hedefler → Bugün).

### Faz 3 · Tek ayrıştırıcı
| # | Adım | Bitti tanımı |
|---|---|---|
| 7 | **C1-b** Mod bandındaki "kendi planını yaz" eski `planExtractor`'dan yeni `capture`'a geçer; eski dosya silinir. | Altın set yeşil; `planExtractor` import'u kalmaz |

### Faz 4 · İlk dakika ("Aklındakileri yaz")
| # | Adım | Bitti tanımı |
|---|---|---|
| 8 | **C0** Ölçüm (`User.Preferences` sayaçları + admin toplamı) ve tanıtımda ne kalır kararı. *Önce S-1 ve S-3 cevabı.* | Sayaç testi; admin raporunda alan |
| 9 | **C2** Giriş ekranı bileşeni: tek alan, 3 örnek, "Atla", canlı çipler (ayrıştırma gecikmeli). | Bileşen testi; uzun metinde donma yok |
| 10 | **C3** "Şunları anladım" önizlemesi: düzelt, çıkar, görev↔alışkanlık; "Planıma ekle" → `createSeedTask` (misafir/çevrimdışı). | Akış testi (misafir dahil) |
| 11 | **C4** Mod önerisi; tarih bulunduysa mod tarihiyle kurulur. | Test: "sınavım 12 aralıkta" → sınav modu 12.12 |
| 12 | **C5** Varış: maddeler akarak gelir, sonra tur. *Önce S-2 cevabı.* | Tur kapısı testi; hareketi azalt'ta durağan |
| 13 | **C6** Mevcut tanıtıma takılır, kaldırılacaklar kalkar; i18n mandalı. | activationFlow testleri yeşil |
| 14 | **KN2** Maestro akışı `kayit-yaz-ekle.yaml` telefonda. | Akış geçer |

### Faz 5 · Canlılık
| # | Adım | Bitti tanımı |
|---|---|---|
| 15 | **B1** Etki hesabı (saf; Y-1 motorunu kullanır; geri alma ters yönde). | Birim testleri (gece yarısı dahil) |
| 16 | **B2** Ana sayfada "+1" çipte, gün halkası bir tık. | Test + telefon |
| 17 | **B3** Sekmeler arası süreklilik (oturum belleği, değişmediyse oynamaz). | Test |
| 18 | **KN3** Render sayacı: saniyelik yalıtım bozulmadı. | Test |
| 19 | **B5** "Sen yokken" satırı (selamın yerine). | Saf fonksiyon testi |
| 20 | **B4** Günün saati tonu (yalnız durum şeridi). | Test + telefon |
| 21 | **B6** Dokunuş denetimi + mandal. | Mandal testi |

### Kararlar — ne zaman gerekli
| Soru | Gerektiği adım |
|---|---|
| S-4 Ekran okuyucu adları = ekran başlıkları onayı | 3'ten önce |
| D-2 Önceden kalma ölü kodu sileyim mi | 6 |
| D-1 "Yedek al"ı not tarafından denemek için telefonda bütçe/kilo modu açılabilir mi | KN-A |
| S-1 Ölçüm `User.Preferences` üzerinden mi · S-3 Hangi slaytlar kalır | 8'den önce |
| S-2 Önce varış animasyonu mu, tur mu | 12'den önce |
