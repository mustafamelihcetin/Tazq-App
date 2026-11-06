# Ana Sayfa ve Bağlı Sayfalar Analizi

Tarih: 2026-11-06. Kapsam: Ana sayfa, Gelen kutusu, Profil, Ayarlar, Ödemeler.

## Yöntem ve sınırlar

- Repo kodu okundu: GoodTime `6c1ddc5`, Tomato `98fa69e`, Reef `044358f`, FocusTide `439d430`, Pomodoist `9260f2e`. Hiçbiri çalıştırılmadı.
- Tazq kodu okundu. Telefonda gezilmedi, kullanıcı testi yok. **UI puanları koddan ve kullanıcının anlattığından çıkar, görerek verilmedi.**
- Gün, Arşiv, Takvim, Başarımlar yalnız yüzeysel tarandı; puanlanmadı.

**Repoların kapsamı:**

| Sayfa | Karşılaştırılabilir kod | Kullanılan |
|---|---|---|
| Ana sayfa | Var | Pomodoist `today_screen`, `task_completion_feedback` |
| Ayarlar, hesap, yedek | Var | Pomodoist `account_delete_dialog`, GoodTime `SettingsScreen`, `backup`, Tomato `SettingsMainScreen`, `backupRestore` |
| Profil | Kısmen | Pomodoist hesap bölümü |
| Gelen kutusu | **Yok** | Bu beş repoda karşılığı bulunmadı |
| Ödemeler | **Yok** | Bu beş repoda karşılığı bulunmadı |

Karşılığı olmayan sayfalar yalnız kendi kodu ve senaryosuyla değerlendirildi.

## Puanlar (yargı, ölçüm değil)

| Sayfa | Senaryo | UI (düşük güven) | Mekanik |
|---|---|---|---|
| Ana sayfa | 7 | 5 | 7 |
| Gelen kutusu | 7 | 7 | 6 |
| Profil | 7 | 6 | 7 |
| Ayarlar | 6 | 6 | 6 |
| Ödemeler | 6 | 7 | 5 |

**Toplam: 6,3/10** (15 puanın eşit ağırlıklı ortalaması).

## Bulgular

### Hatalar

| # | Sayfa | Bulgu | Kanıt | Çözüm yönü |
|---|---|---|---|---|
| 1 | Ödemeler | **Vade hatırlatması yalnız Ödemeler ekranı açılınca kurulur.** Ekranı açmayan kullanıcı yeni dönem için bildirim almaz; başka cihazda eklenen ödeme de öyle | `schedulePaymentDueNotif` tek çağrısı `app/odemeler.tsx:268`; depo ya da açılış kodunda yok | Kurma işini ekrandan çıkar; uygulama açılışında ve ödeme verisi değişince eşitle |
| 2 | Ana sayfa | **"4 adımın 2 tanesi tamam" kutusu panelden kopuk.** `surfaceContainerHigh` kart, panelin içinde; koyu temada panelle aynı renk üstüne %28 siyah gradyanla biniyor, açık temada beyaz panelde koyu blok kalıyor. Altında mod satırları ve ayraç da var, yani üstte iki katman aynı işi yapıyor | `RouteBanner.tsx`, `DisplayPanel.tsx:54,59`, `ModeTodayCard.tsx:193` | Kartı kaldır; panelin kendi satırı ve ince ilerleme çizgisi. Mod satırlarıyla tek yuvada birleştir |

### Senaryo eksikleri

| # | Sayfa | Bulgu | Kanıt | Repo karşılığı |
|---|---|---|---|---|
| 3 | Ana sayfa | Görev tamamlanınca geri alma bildirimi yok; geri almak için bitenler bölümünde bulup yeniden dokunmak gerekiyor | `app/index.tsx` ve `MyDay*` içinde undo yok | Pomodoist `completeTaskWithUndoFeedback`: 7 sn geri alma |
| 4 | Gelen kutusu | Ödeme satırı yalnız Ödemeler'e götürür; "ödendi" oradan verilemiyor | `app/index.tsx:1613` | Karşılık yok; geri almalı tek dokunuş önerisi benim |
| 5 | Ödemeler | Düzenle ve Sil sistem uyarısında, silmede geri alma yok; ödendi işaretinde var. Tutarsız | `app/odemeler.tsx:166,236,231` | Karşılık yok |
| 6 | Ayarlar | Dışa aktarma var (JSON, MD), geri yükleme yok. Hesaplıda bulut var, misafirde veri geri dönmez | `dataExport.ts`; import kodu yok | GoodTime ve Tomato: yedek ve geri yükleme; GoodTime ayrıca CSV |
| 7 | Ayarlar | Günün başlangıcı sabit: 3 saat tamponu kodda. Gece çalışan için ayarlanamıyor | `useFocusStore.ts` `getLocalDateString` | GoodTime `settings_custom_start_of_day` |

### UI ve yapı

| # | Sayfa | Bulgu | Kanıt | Repo karşılığı |
|---|---|---|---|---|
| 8 | Ana sayfa | İlk görevden önce çok katman: durum şeridi, rota, mod satırları, ayraç, çiçek ve cümle, halkalar. Görev listesi ekranın altına itiliyor | `TodayRings`, `ModeTodayCard`, `app/index.tsx` sırası | Pomodoist Today: başlık, tarih, tek özet satırı, liste, bitenler (`today_screen.dart`) |
| 9 | Ana sayfa | `app/index.tsx` 2.320 satır, 18 state, 20 etki, 8 açılır yüzey | Sayım | Pomodoist ekranı ince, durum view model'de. Kapsamları farklı, birebir kıyas değil |
| 10 | Profil/Ayarlar | Aynı sayfanın adı farklı: Profil "Hesap, Yasal & Destek", açılan başlık "Hesap & Destek" | `profile.tsx`, `settings.tsx:95` | - |
| 11 | Ayarlar | Dil dallanması yüksek: `settings.tsx` 65, `profile.tsx` 27 satır içi dil koşulu; metin kayması riski | `grep`, `i18nRatchet` | Pomodoist tüm metinleri `l10n` üzerinden |
| 12 | Ödemeler/Ana | Aynı vade bilgisi hem ana sayfa kartında hem gelen kutusunda | `PaymentsSummaryCard`, `inboxItems.ts` | Karşılık yok |

### Dokunulmaması gerekenler

- **Durumdan hesaplanan gelen kutusu:** `inboxItems.ts` saklamıyor, kaynaktan üretiyor; ödeme ödenince kendisi düşüyor. Çözüldüğü halde asılı kalan uyarı yok.
- **Boş durum:** `app/index.tsx` görev ve alışkanlık yokken üç yön sunuyor, örnek veriyle çelişmiyor.
- **Ayar yapısı:** Profil, ayarları dört kategoriye ayırıyor; Tomato ve GoodTime'ın ana ve alt ekran yapısıyla aynı fikir.
- **Hesap silme:** yazarak onay, parolasız girişler dahil. Pomodoist çift onaylı; ikisi de güvenli.
- **Kullanıcı dışa aktarması:** Ayarlar'dan veri indirilebiliyor.
- **Reef'i örnek almayın:** açılışta topluluk ve bağış diyalogları gösteriyor (`MainScreen.kt`).

## Sıra

1. Ödeme hatırlatmasını ekrandan çıkar (1).
2. Rota kutusunu panele yedir, üst katmanı tek satıra indir (2, 8).
3. Görev tamamlamada 7 sn geri alma (3).
4. Gelen kutusundan tek dokunuşla ödendi (4), silmede geri alma (5).
5. Başlık ve metin düzeni (10, 11), misafir için geri yükleme (6).
6. Gün başlangıcı ayarı (7), `app/index.tsx` bölme (9).
