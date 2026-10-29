/**
 * MOD GÖREVİ DÜZENLEME KORUMASI (madde 3).
 *
 * Modların ürettiği görevler başlığını iki dilde `description` alanındaki bir yükte
 * taşır: `{"tr":"Su iç","en":"Drink water","descTr":…}`. Ekranda dil o yükten seçilir
 * (bkz. getLocalizedTaskTitle), dil değişince başlık kendiliğinden çevrilir.
 *
 * Düzenleme formu bu yükü HAM JSON olarak "Notlar" alanına koyuyordu. Tek harf
 * değişikliği JSON'u bozuyor; görev artık çevrilemiyor ve mod motoru onu tanımıyordu.
 * Kural: yük ve başlık kilitli, kaydederken olduğu gibi korunur. Güvenli alanlar —
 * tarih, saat, tekrar, öncelik, hatırlatıcı, alt görevler — serbest.
 */

type Editable = { title: string; description?: string | null };

/** Görev iki dilli mod yükü taşıyor mu? */
export function isModeContentTask(task: Editable | null | undefined): boolean {
  const d = task?.description;
  if (!d || !d.startsWith('{"tr":')) return false;
  try {
    const p = JSON.parse(d);
    return typeof p?.tr === 'string' && typeof p?.en === 'string';
  } catch {
    return false;
  }
}

/** Kaydedilecek başlık ve açıklama: mod görevinde orijinal, diğerlerinde formdaki (kırpılmış). */
export function protectModeContent(task: Editable | null | undefined, form: { title: string; description: string }) {
  if (task && isModeContentTask(task)) return { title: task.title, description: task.description as string };
  return { title: form.title.trim(), description: form.description.trim() };
}
