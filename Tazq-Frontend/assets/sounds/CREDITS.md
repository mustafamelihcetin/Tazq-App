# Ortam sesleri — kaynak ve lisans

Odak ekranının ortam sesleri (2026-11-01, v2). Uygulamada isim anma zorunluluğu yok; kayıt için tutulur.

| Dosya | Kaynak | Lisans | İşlem |
|---|---|---|---|
| rain.m4a | Moodist `sounds/rain/light-rain.mp3` | CC0 / Pixabay İçerik Lisansı | 70 Hz yüksek geçiren, döngü başı en durağan ana kaydırıldı, 8 sn çapraz geçiş |
| wind.m4a | Moodist `sounds/nature/wind.mp3` | CC0 / Pixabay İçerik Lisansı | 40 Hz yüksek geçiren, 5 sn çapraz geçiş |
| forest.m4a | Moodist `nature/wind-in-trees.mp3` + `animals/birds.mp3` (−7 dB) | CC0 / Pixabay İçerik Lisansı | iki katman karıştırıldı, 5 sn çapraz geçiş |
| ocean.m4a | Moodist `sounds/nature/waves.mp3` | CC0 / Pixabay İçerik Lisansı | 4 sn çapraz geçiş |
| fireplace.m4a | Moodist `sounds/nature/campfire.mp3` | CC0 / Pixabay İçerik Lisansı | çıtırtı tepeleri sınırlandı, 4 sn çapraz geçiş |
| cafe.m4a | Moodist `sounds/places/cafe.mp3` | CC0 / Pixabay İçerik Lisansı | sakin uğultu: 120 Hz–4.5 kHz, 3.2 kHz'te −4 dB, yumuşak sıkıştırma; yalnız sakin parçalar (kahkaha/bağırma elendi). İlk seçilen `restaurant` kaydı keskin konuşmalarla baş ağrıtıyordu (kullanıcı) |
| relaxing.m4a | Üretildi (Tazq) | — | Re majör çevresinde dört akor, 5 sn yankı |
| binaural.m4a, brown.m4a | Üretildi (Tazq, 2026-10-25) | — | — |

Moodist: https://github.com/remvze/moodist — kod MIT; README'ye göre sesler CC0 ya da Pixabay İçerik Lisansı
(https://pixabay.com/service/license-summary/): ticari kullanım serbest, isim anma gerekmez; sesin
değiştirilmeden tek başına satışı yasak (uygulama içinde kullanım serbest).

Hepsi: −26 LUFS, gerçek tepe ≤ −3 dBTP, stereo 44.1 kHz, AAC 96 kbps (.m4a). Eski dosyalar: `archive/2026-11-01/`.

DÖNGÜ İÇİ TEKRAR YOK: kayıtlar art arda kopyalanarak uzatılmaz. Kaynaktan rastgele 7–13 sn'lik parçalar
(okyanusta 14–22 sn) karışık sırayla, eşit güçlü geçişlerle 180 sn'ye örülür; art arda iki parça kaynakta
birbirinden uzak seçilir. İlk sürüm 54 sn'lik ormanı 150 sn'de üç kez tekrarlıyordu (kullanıcı fark etti;
zarf ölçümünde 54. saniyede 0.23 benzerlik → şimdi 0.02).

DÖNGÜ KENARI: AAC kodlayıcı dosya başını sıfıra yakın başlatır; kenarlara 4 ms mikro yumuşatma uygulanır,
aksi halde döngü noktasında tık olur (rüzgarda ölçüldü: kenar adımı doğal akışın 25 katıydı).
