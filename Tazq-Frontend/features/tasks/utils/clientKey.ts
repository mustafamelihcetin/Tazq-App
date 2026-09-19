/**
 * GÖREV OLUŞTURMA ANAHTARI — aynı görev iki kez oluşmasın.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Canlı veride aynı görevin ardışık numaralı İKİZLERİ bulundu (ör. "her ayın 27'si"
 * görevinin iki kopyası, ikisi de "8 gün kaldı"). Sebep: elle eklenen görevler
 * anahtarsız gönderiliyordu. Form sunucuyu 4,5 sn bekleyip zaman aşımını "ağ yok"
 * sayıyor ve görevi çevrimdışı kuyruğa da koyuyordu — oysa sunucu ilkini çoktan
 * oluşturmuştu; kuyruk ikincisini oluşturdu. Cevabı yolda kaybolan her istekte aynısı.
 *
 * Sunucu bu korumayı zaten veriyor (aynı kullanıcıda, tamamlanmamış, aynı anahtarlı
 * görev varsa yenisini oluşturmaz, mevcudu döndürür — bkz. TaskService.CreateTaskAsync).
 * Yalnız plan görevleri kullanıyordu.
 *
 * KURAL: anahtar görev için BİR KEZ üretilir; ilk istek de kuyruktaki tekrar da aynı
 * anahtarı taşır. Yeni anahtar üretmek korumayı sessizce iptal eder.
 */

/** Kullanıcının eklediği görev için tekil anahtar (≤ 64 karakter, sunucu sınırı). */
export function newTaskKey(): string {
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Tekrarın bir sonraki örneği için DETERMİNİSTİK anahtar: aynı kaynak + aynı tarih →
 * aynı anahtar. Tamamla → geri al → tamamla, aynı örneği ikinci kez üretemez.
 */
export function nextInstanceKey(sourceId: number, dueDate: string | null | undefined): string {
  return `n-${sourceId}-${String(dueDate ?? '').slice(0, 10)}`;
}
