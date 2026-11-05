# Sınav Modu v2: tasarım (2026-11-05)

Durum: **uygulandı** (`features/studyplan`, `app/plan.tsx`), commit kullanıcıda. Uygulama planı: [sinav-modu-plan.md](sinav-modu-plan.md). Simülasyon depo dışında, prototip olarak koşuldu.

## 1. Amaç

Kullanıcı sınavını, tarihini ve ayırabildiği süreyi söyler. TAZQ her gün "bugün ne çalışayım?" sorusunu cevaplar, takvimde bütün yolu gösterir, plan bozulunca kullanıcıyı suçlamadan yeniden kurar ve neyin sığmadığını dürüstçe söyler.

TAZQ **plan aracıdır, kaynak değildir**: konu anlatımı, soru bankası, taban puan listesi ve sıralama tablosu yoktur.

## 2. Bugünkü sorunlar (koddan)

| Sorun | Kanıt | Sonuç |
|---|---|---|
| Konu, görev **üretilince** "çalışıldı" sayılıyor | `usePlanAdaptations.ts:1219` | Hiç çalışmayan kullanıcıda bile plan ilerliyor, kaçan konu dönmüyor |
| Görevlerin çoğu konudan bağımsız | `dailyPlanEngine.ts` havuzları | "Dünkü denemenin yanlışlarını tekrar et" görevi, deneme yapılmadan da gelebiliyor |
| Faz yalnız kalan güne bağlı | `getPhase`: ≤30 gün "son sprint" | 30 gün kala hiç başlamamış birine "yeni konu YOK" deniyor |
| Ders ağırlığı gerçek dağılımı yansıtmıyor | KPSS'de Tarih, Coğrafya, Vatandaşlık, Güncel hepsi 1 | Kaynaklarda 27/18/9/6 soru deniyor; 6 soruluk ders, 27 soruluk kadar gün alıyor |
| Süre tek değer | `HOURS_OPTIONS` | Hafta içi 1 saat, hafta sonu 5 saat ayıran çalışan anlatılamıyor |
| Sonuç verisi yok | Deneme kaydı yok | Plan gerçek başarıya göre değişemiyor |
| İlerleme yalnız cihazda | `useSubjectStore` | Telefon değişince gidiyor |
| Gerçekçi olmayan görev | "Her gün tam DGS denemesi" | 135 dakikalık sınav hata analizine yer bırakmıyor |
| Veri eşitsiz | KPSS 30 konu, DGS 7, ÖABT 7; AÖF ve Katiplik yok | Bazı sınavlarda plan yüzeysel kalıyor |
| Sınav sayısı 3 | `exam`, `exam2`, `exam3` | Vize/final dönemindeki 5-6 ders sığmıyor |

## 3. Simülasyonun öğrettikleri

Prototip ve senaryolar: `C:\Users\melih\AppData\Local\Temp\claude\52c9ce58d2343276\297ccdab-abd8-4eb6-83bc-0c04044d5d24\scratchpad\simsinav\`

**Bu yüzdeler sınav başarısı tahmini değildir.** Konu saatlerini ve unutma hızını ben varsaydım. Değerler yalnız aynı model içinde karşılaştırma içindir. "Hatırlanan": sınav günü, öğrenilmiş ve hâlâ akılda olan soru payı.

| Senaryo | Bugünkü motor (model) | Yeni tasarım |
|---|---|---|
| KPSS, 240 gün, 3 saat/gün, 14 gün kopuş | %27 | **%85** |
| KPSS, 365 gün, 4 saat/gün | %65 | **%86** |
| KPSS, 200 gün, 60. günde iş buluyor (4 saat → 1 saat) | %32 | **%64** |
| KPSS, 150 gün, 30 gün kopuş | %17 | **%53** |
| DGS, 120 gün, %40 uyum | %28 | **%45** |
| DGS, ileri seviye, 60 gün | %85 | **%93** |
| DGS, geç başlangıç, 25 gün | %17 | **%24** |
| KPSS, 120 gün, 30 dk/gün | %4 | **%10** |
| DGS, çalışan, hafta içi 1 saat, hafta sonu 4 saat | %57 | %56 (kazanç yok) |
| DGS, tarih 50 gün öne çekiliyor | %58 | **%68** |
| DGS, 3 gün kaldı | %3 | %3 (kazanç yok) |

Tüm senaryolarda günlük kapasite hiç aşılmadı, plansız gün kalmadı. Uzun süreli hazırlıkta fark en büyük, çünkü tekrar burada değer üretiyor. Süre zaten yetmiyorsa hiçbir plan mucize yaratmıyor; orada değer, neyin sığmadığını söylemekte.

Modelin eski motora kolaylığı: her dakikayı tam konu öğrenmesi sayıyor. Yeni tasarıma haksızlığı: denemenin faydasını çok az sayıyor. Gerçek fark deneyle ölçülmeli.

**Denerken çıkan kusurlar (asıl değer burada):**

| # | Kusur | Tasarıma etkisi |
|---|---|---|
| 1 | 15 dakikanın altında kalan konu kalıntısı planı kilitledi | Kalıntı küçük blokla bitirilir, eşik yok |
| 2 | "Tek formül" (dakika başına en çok soru) yeni konuya hiç geçmedi: KPSS %38'de kaldı | **Reddedildi.** Yeni konu, tekrar ve deneme için ayrı bütçe |
| 3 | Sabit son hafta, 30 dk/gün çalışana yetmedi | Son tur uzunluğu tekrar edilecek konu sayısından hesaplanır (3-21 gün) |
| 4 | Önceliklendirme konuyu daraltınca dakikalar boşa gitti | Kalan süre her zaman kullanılır |
| 5 | Puan iyi olsa da takvim "6 gün üst üste aynı konu" gösterdi | Önce ders payına göre seç, sonra konu; üst üste sınırı. **Tam çözülmedi** (madde 11) |
| 6 | "Konu bitti" işareti tekrar zincirini başlatmıyordu | İşaret tekrarı başlatır; test zorunlu |

**Dayanıklılık (DGS, 120 gün):** Saatler doğruyken sonuç %75. Plan saatleri 2 kat yanlış varsayarsa %48-52'ye düşüyor; kullanıcı konu bitişini işaretlerse %72-74'e dönüyor. Yani **"konu bitti" işareti, veri doğruluğundan önemli.** Süreleri kusursuz bilmek zorunda değiliz.

**Haftalık sabitleme:** Takvimin önümüzdeki 7 gününü sabit tutmanın maliyeti 0-2 puan. Bu yüzden takvim her gün değişmez.

**İki sınav:** Süreyi baskıya göre bölmek (kalan iş / kalan gün), yakın sınav için eşit bölmeden belirgin iyi: DGS 45 gün + KPSS 300 gün senaryosunda DGS %20 → %31, KPSS %88 → %84. Tarihler yakınsa fark küçülüyor.

**Performans:** 365 günlük plan bilgisayarda 11 ms. Telefonda ölçülmedi.

## 4. Mekanizma

### 4.1 Beş kural (değişmez)

1. **Gerçekleşen esastır:** Plan yalnız yapılana göre ilerler. Görev üretmek ilerleme değildir.
2. **Kapasite tavandır:** Kaçan iş sonraki günlere yığılmaz; kalan yol yeniden dağıtılır, sığmayan açıkça söylenir.
3. **Bugün sabittir:** Bugünün planını yalnız kullanıcı değiştirir, önümüzdeki 7 gün de korunur. Yeniden dağıtım ondan sonrasını etkiler. Büyük değişiklikte (tarih, kapasite, kopuş) kullanıcıya sorulur.
4. **Her şey cihazda çalışır:** İnternetsiz, LLM'siz ve aynı girdiyle aynı sonucu veren saf fonksiyon.
5. **Vaat yok:** "X net yaparsın" denmez. Yalnız "sığıyor / sıkışık / sığmıyor" ve gerekçesi söylenir.

### 4.2 Veri katmanları

```
Sınav haritası (uygulamayla gelir, güncellenebilir)
  bölüm → ders → konu: soru payı, tahmini saat, tür (ezber / beceri / dil becerisi)
  deneme süresi, puan modeli, kaynak ve doğrulama tarihi

Kullanıcı planı
  sınav, tarih, 7 günün dakikası, kapalı tarihler, başlangıç seviyesi, hedef

Gerçekleşen kayıt (buluta eşitlenir; konu başına son yazan kazanır, denemeler birleşir)
  konu: kapsam, unutma tahmini, sıradaki tekrar, zorluk
  deneme: bölüm sonuçları, yanlış nedenleri
  bugün ve yakın 7 gün: yalnız cihazda, gerekirse yeniden hesaplanır
```

Bilinmeyen sınav boş kalmaz: kullanıcı konularını kendi yazar (madde 7).

### 4.3 Günün planı

1. Kapalı gün mü, sınav mı, arife mi? Arife: en çok 30 dakika hafif tekrar. Sınav günü: görev yok.
2. Bütçe: bugünkü dakika. Kopuştan dönüşte ilk 3 aktif gün %60.
3. Deneme zamanı mı? Soru ağırlıklı kapsam ≥ %35 ise, 14 → 7 → 3-4 günde bir, haftanın en uzun gününe konur. Tam sınav sığmıyorsa bölüm denemesi. Analiz aynı gün ayrılır.
4. Zamanı gelen tekrarlar en çok bütçenin %40'ı kadar (dönüşte %80). Fazlası yığılmaz, en değerli olan seçilir.
5. Son tur başladıysa yeni konu yok; kalan zaman tekrar. Hiç hazırlık yoksa (%15 altı) son tur uygulanmaz, en çok soru getiren konuya gidilir.
6. Yeni konu: payının gerisinde kalan ders → o dersin en değerli konusu. Kalan dakika boşa gitmez.

**Sığma hesabı** her gün yapılır: kalan iş, kişinin gerçek uyumuyla çarpılmış kalan kapasiteyle karşılaştırılır. Sığmıyorsa konular "soru / kalan saat" sırasına dizilir, en düşükler "şimdilik dışarıda" olur ve yer açılırsa geri gelir.

**Tekrar aralığı:** Başlangıç 2-7-21-45 gün. "Kolay / orta / zor" cevabı ve deneme sonucu aralığı değiştirir. Kullanıcıya görünmez, yalnız "bugün tekrar" der.

### 4.4 Girdi yükü (kullanıcıyı boğmamak)

| Ne zaman | Ne ister | Süre |
|---|---|---|
| Kurulum | Sınav + tarih, haftalık süre, seviye (ders başına isteğe bağlı) | 30-60 sn |
| Blok bitince | Görevi işaretle. Odak seansından geldiyse otomatik | 1 dokunuş |
| Konu bitince | Kolay / orta / zor | 1 dokunuş |
| Yapamayınca | Bugün olmaz | 1 dokunuş |
| Deneme sonrası | Bölüm başına doğru/yanlış; isteğe bağlı yanlış nedeni | 1 dakika |

Hiç veri girmeyen kullanıcıda da plan çalışır. Veri geldikçe plan iyileşir, zorunlu alan eklenmez.

**Yanlış nedeni eyleme dönüşür:** bilmiyordum → konu yeniden çalışılır; unuttum → tekrar öne çekilir; dikkat → karma test; süre → süreli set.

### 4.5 Ekranlar

- **Takvim:** `MonthCalendar` üstünde ay görünümü; gün rengi derse göre, deneme ayrı işaret. Aşamalar şerit olarak görünür. Güne basınca bloklar listelenir. Geçmiş gün gerçekte yapılanı, gelecek gün planı gösterir; ikisi görsel olarak ayrıdır.
- **Bugün:** "Problemler · 40 dk" gibi somut iş; "Başla" Odak seansını konuya bağlar.
- **Konu haritası:** Ders → konu; başlanmadı / çalışılıyor / bitti / tekrarda. Dokununca durum değişir. "Bunu zaten biliyorum" ile plandan çıkar.
- **Durum satırı:** "Sığıyor" veya "Sıkışık: 3 konu dışarıda (gör)". Yüzde ve puan yok.
- **Deneme:** Hızlı kayıt + küçük ders bazlı eğilim.

Mevcut kurallar korunur: günlük plan bütçesi (4), mod başına 2 rutin, duruma göre kurulan ana ekran. Plan görevleri bugüne kadar taşınamıyordu; "bugün olmaz" bu kuralı bozmaz, yeniden dağıtımı tetikler.

## 5. Senaryo kataloğu

| Grup | Senaryo | Davranış |
|---|---|---|
| **Süre** | 1 yıl+ | Sakin tempo, geniş tekrar aralığı; sınavı sonraki yıla çıkan yıl için de çalışır |
| | 3-8 ay | Standart |
| | 30-60 gün | Değer sıralı; ilk ekranda neyin sığmadığı |
| | 3-14 gün | "Tam plan mümkün değil. En çok soru getiren şu 3 konu"; moral bozmadan |
| | Tarih bilinmiyor | Tahmini tarih, belirginleşince sorar |
| | Sınav bugün / geçmiş | Kurulum engeller; bittiyse kapanış |
| **Kapasite** | Çalışan, hafta sonu ağırlıklı | Tam deneme hafta sonuna; hafta içi kısa bloklar |
| | Vardiyalı | Haftalık düzen + tek gün düzeltme |
| | Günde 30 dk | Tam deneme yerine bölüm denemesi; uzun son tur |
| | Tam zamanlı | Üst sınır 6 saat; günde en az bir dinlenme uyarısı |
| | Tatil, bayram, Ramazan, hastalık | Kapalı tarih; plan öncesi/sonrası dağılır |
| | İş buldu, süre düştü | "Bu hafta süren değişti mi?" + yeniden dağıtım onayı |
| **Seviye** | Sıfırdan | Tüm konular |
| | Tekrar eden (ikinci girişi) | Tanı denemesi önerilir, konu seviyesi öğrenilir |
| | Tek ders zayıf | Ders bazlı seviye + kullanıcı beyanı |
| | Hedef yüksek | Hedef bilgi olarak saklanır, kapasiteyi aşmaz |
| **Davranış** | Hep erken bitiren | "Bugün bir blok daha?" isteğe bağlı; yük kendiliğinden artmaz |
| | Düzenli %50 | Takvim gerçek uyuma göre yeniden hesaplanır |
| | 3-30 gün kopuş | Geri dönüş haftası, suçlama yok, tek dokunuş |
| | Uygulamayı hiç işaretlemeyen | Sessizce ilerlemez; 3 gün sonra "çalıştın mı?" toplu cevap |
| | Sırayı beğenmeyen | Konu sırası değiştirilebilir; kilit konu kavramı yok |
| | Kurs/dershane takibi | Kendi konu sırası ya da haftalık konu girişi |
| **Değişiklik** | Tarih erkene/geçe | Anında sığma hesabı + özet |
| | Sınav iptal/ertelendi | Hedefi koru, tarih güncelle; iptalde kapanış |
| | Sınav değiştirme (KPSS → DGS) | Ortak konular taşınır |
| | Telefon değişimi | Buluttan geri gelir; boş veri doluyu ezmez (bkz. mod silinmesi kök nedeni) |
| **Çoklu** | İki sınav, uzak tarih | Baskıya göre pay; çok yakında en az %20 alt sınır |
| | Ortak dersler (KPSS + DGS Türkçe) | v1'de ayrı, sonra paylaşımlı |
| | Vize/final: 5-6 ders | Slot yerine dönem: kendi dersler, kendi tarihler |
| **Sınav türü** | Oturumlu (TYT/AYT, KPSS Alan) | Bölüm ve tarih ayrı |
| | Yılda çok kez (ALES, e-YDS) | "Bir sonraki oturum?"; sonuç sonrası devam |
| | Seçmeli alan (YKS SAY/EA/SÖZ, KPSS lisans/ön lisans) | Kurulumda alan sorusu |
| | Dil sınavı | Soru değil beceri; yazma/konuşma blokları |
| **Sınav sonrası** | Bitti | Tek ekran: emek özeti, "sonuç nasıldı?", arşiv |
| | Kaldı/tekrar girecek | Veri korunur; yeni tarih, zayıf konular önde |

## 6. EN kullanıcılar

### 6.1 Hangi sınavlar

Bugünkü İngilizce sınavlar: IELTS, TOEFL, PTE, GRE, GMAT, USMLE. **Eksik ve önerilen sıra:**

| Öncelik | Grup | Sınavlar |
|---|---|---|
| 1 | Her ülkede geçerli | **Okul sınavları (final/midterm)**, kendi sertifikası |
| 1 | Üniversiteye giriş (ABD) | SAT, ACT, AP |
| 1 | Dil | IELTS ve TOEFL'i derinleştir; Duolingo English Test, Cambridge |
| 2 | Lisansüstü | GRE, GMAT'i derinleştir; LSAT, MCAT |
| 2 | Birleşik Krallık / IB | GCSE, A-Level, IB (ders bazlı: kendi konu listesi şablonu) |
| 2 | Sağlık | USMLE'yi derinleştir; NCLEX, PLAB |
| 2 | Mesleki | CFA, CPA, ACCA, PMP, baro sınavı |
| 3 | Teknoloji | AWS, Azure, CompTIA |
| 3 | Başka diller | JLPT, HSK, DELE, DELF, Goethe |
| 3 | Yaşam | GED, ehliyet teorisi, vatandaşlık sınavı |

Bu sınavların hepsine harita yazmak gerçekçi değil ve yanlış müfredat zarar verir. Bu nedenle **madde 7'deki kendi sınavını oluştur** özelliği EN tarafının omurgasıdır; derin harita önce SAT ve IELTS'e yapılır.

### 6.2 "Net" evrensel değil: puan modeli haritada

| Model | Örnek | Takip |
|---|---|---|
| Yanlış götürür | DGS (4 yanlış 1 doğru), KPSS, YKS | Net |
| Ölçekli puan | SAT, ACT, GRE, GMAT | Toplam + bölüm puanı |
| Bant | IELTS | Beceri başına bant |
| Geçti/kaldı | NCLEX, PMP, ehliyet | Deneme yüzdesi + hazır hissi |
| Not | Okul sınavı | Yüzde/not |

### 6.3 Tasarımı etkileyen diğer farklar

- **Bazı sınavlarda oturum kişinin seçimi:** IELTS gibi sınavlarda tarih rezervasyonla belirlenir. Sistem "Sınavını ayırttın mı?" hatırlatır; "geriye sayım hedefi" ile "kesin tarih" ayrıdır.
- **Uyarlanabilir sınavlar:** SAT modül bazında uyarlanır. Deneme önerisi resmî uygulamaya yönlendirir, puanı kullanıcı girer.
- **Beceri sınavları:** Yazma ve konuşma için "soru çöz" değil "1 kompozisyon yaz, süreyi tut". Dil havuzları bu yönde genişler.
- **Birden çok ders:** IB/A-Level/AP, tek sınav değil ders kümesidir; dönem yapısıyla çözülür.
- **Yerelleştirme:** Hafta başlangıcı (`MonthCalendar` Pazartesi sabit, ABD'de Pazar beklenir), tarih biçimi, dil dosyaları. Ramazan/bayram yerine genel "kapalı tarihler".
- **Çeşitli kullanıcı:** TR arayüzde IELTS, EN arayüzde KPSS olabilir. Sınav listesi dile göre kapanmaz, yalnız sıralaması değişir. Konu adları iki dilde tutulur.
- **Ad kullanımı:** Sınav adları yalnız tanım için kullanılır; resmî bağlantı ima edilmez, soru içeriği kopyalanmaz.

## 7. Kendi sınavını oluştur

Ad + tarih + konular (alt alta yaz veya yapıştır) + isteğe bağlı konu önemi (az / normal / çok). Her konu varsayılan olarak eşit saat alır; ilk tamamlanan konulara göre kişisel hız öğrenilir.

Bu özellik; vize/final, sertifika, hazırlık kursu ve haritası olmayan her sınavı kapsar. Dönem sayfası birden çok dersi aynı takvimde toplar. Kapsamı en geniş tek özellik budur.

## 8. Doğru veri

- Soru dağılımı, süre ve puan modeli **resmî kaynaktan** ve doğrulama tarihiyle yazılır. Bulduğum kaynaklar ticari siteler ve çelişkili:
  - KPSS Lisans 120 soru; Tarih 27, Coğrafya 18, kalan 15'in bölümü tartışmalı; süre 130 ve 150 dk geçiyor.
  - 2027 takvimi 28 Ekim 2026'da yayımlanmış ama haberlerde tarihler çelişiyor.
- **Bu yüzden hazır tarih otomatik dolmaz.** "ÖSYM: 18 Temmuz 2027" önerisi resmî PDF'ten doğrulandıktan sonra girilir ve kullanıcı onaylar.
- Konu saatleri tahmindir ve simülasyonda hatalara dayanıklı çıktı. Kişisel hız zamanla öğrenilir.
- Müfredat değişince uygulama güncellemesi gerekmez: `setCurriculum` tasarımı buna göre yazılmış, bağlantısı uygulama sırasında kontrol edilecek.

## 9. Repolardan alınanlar

| Repo | Ne alıyoruz | Ne almıyoruz |
|---|---|---|
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (FSRS) | Unutma tahmini fikri; ileride kart özelliği gelirse hazır motor | Şimdi bağımlılık eklemek: kart için tasarlandı, "Paragraf" gibi geniş konu kart değildir |
| [Ebisu](https://github.com/fasiha/ebisu) (Unlicense) | Kısmi başarıyı (0-1) güncellemeye katma: kolay/orta/zor ve deneme yüzdesi | Bayes hesabı; bu ölçekte sade formül yeter |
| [Duolingo HLR](https://github.com/duolingo/halflife-regression) (MIT) | Unutma süresini geçmişten öğrenme fikri; sonraki aşamada kişisel ayar | Model eğitimi: bizde bu veri yok |
| [pyBKT](https://github.com/CAHLR/pyBKT) (MIT) | Hakimiyetin sınavlarla güncellenmesi fikri | Soru başına veri ister, TAZQ soru tutmuyor |
| [studykit](https://github.com/btgaskin/studykit) (lisans görünmüyor) | "Plan sabit, takvim uyarlanır, ilerleme gerçeği izler"; önceden belirlenmiş kurtarma stratejisi | Kod |
| [OpenPrep-AI](https://github.com/Jivan-Patel/OpenPrep-AI) (MIT) | Rakip örneği: uyarlama yol haritasında, çalışır halde değil | LLM bağımlılığı |

Bilimsel dayanak: tekrar aralığı hedef süreye göre büyümeli ([Cepeda 2008](https://www.evullab.org/pdf/CepedaVulRohrerWixtedPashler-PS-2008.pdf)); en yararlı yöntemler kendini test etme ve aralıklı çalışma ([Dunlosky 2013](https://www.doi.org/10.1007/s10648-012-9205-z), özetlerden doğrulandı, özgün makaleyi okumadım).

## 10. Uygulama parçaları

| Kimlik | Sorumluluk | Bağımlı |
|---|---|---|
| `exam-blueprint` | Sınav haritası, puan modeli, kendi sınavı, veri doğrulama | — |
| `exam-ledger` | Gerçekleşen kayıt, konu durumu, bulut birleştirme, göç | blueprint |
| `exam-scheduler` | Saf planlayıcı, sığma hesabı, son tur, çoklu sınav | blueprint, ledger |
| `exam-setup` | Kurulum akışı | scheduler |
| `exam-today` | Bugün + Odak bağlantısı + "bugün olmaz"; `markStudied` hatasının bitişi | scheduler |
| `exam-calendar` | Takvim, konu haritası, durum satırı | scheduler, today |
| `exam-mocks` | Deneme, yanlış nedeni, plana etkisi | ledger, scheduler |
| `exam-lifecycle` | Kopuş, değişiklik, sınav sonu, tekrar girme | hepsi |
| `exam-en` | SAT/IELTS derin harita, beceri blokları, hafta başlangıcı | blueprint, setup |

Sıra: blueprint → ledger → scheduler → setup + today → calendar → mocks → lifecycle → en.

İlk üçü görünmez çekirdektir. **İlk görünür teslim: setup + today + calendar.** Mevcut kullanıcı: eski `lastStudied` güvenilmez (kanıt: madde 2), yalnız ipucu olarak kullanılır; kullanıcıya bir kez "Hangi konular bitti?" sorulabilir.

Yapılmaması gerekenler: yedi modun diğerlerine dokunmak; alışkanlık sınırını değiştirmek; LLM eklemek. Backend tablosu gerekirse önce sorulur; başlangıç önerisi `User.Preferences` (boyut sınırı uygulamada ölçülecek).

## 11. Bitti tanımı

**Her senaryo otomatik test olur (planlayıcı saf olduğu için mümkün):**

- Hiçbir gün yük, kullanıcının süresini aşmaz.
- Kaçan blok hiçbir günü kapasite üstüne çıkarmaz; 30 gün kopuş sonrası ilk gün ≤ %60.
- Tamamlanmayan konu ilerlemiş sayılmaz.
- "Konu bitti" tekrar zincirini başlatır.
- Sınav günü görev yok, arife ≤ 30 dk.
- Hazırlığı yeterli kullanıcıya son turda yeni konu yok.
- Aynı girdi aynı plan (saat dilimi ve gece yarısı dahil).
- Önümüzdeki 7 gün, kullanıcı değiştirmedikçe sabit.
- Boş buluttan gelen kayıt dolu yerel kaydı silmez.
- 365 günlük plan orta sınıf Android'de 50 ms altında.
- Aynı konu üst üste en çok 3 gün (başka açık konu varsa): `studyPlanScheduler.test.ts`.

**Takvim insan testi:** Simülasyon rakamları iyi olsa da takvim çıktısı ayrıca okunur; 6 günlük tekrar kusuru yalnız böyle görüldü.

**Gerçek dünya (yayından sonra, kişisel veri olmadan, toplu):** ilk hafta devam oranı, kopuş sonrası dönüş, plan başına tamamlanan blok. Simülasyon varsayımlarını bu veri düzeltir.

## 12. Bilerek ertelenenler

Bildirim ve Widget'a sınav bloğu, ortak ders paylaşımı, kişisel unutma modeli, kart/ezber özelliği, arkadaşla çalışma. Çekirdek oturmadan eklenmez.
