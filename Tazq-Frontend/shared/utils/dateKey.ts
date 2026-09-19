/**
 * TAKVİM TARİHİ ANAHTARI — kullanıcının SEÇTİĞİ günü kaydeden tek yol.
 *
 * ── HANGİ HATAYI ÖNLÜYOR ────────────────────────────────────────────────────────
 * Tarih seçicilerden dönen `Date` her yerde `d.toISOString().split('T')[0]` ile
 * kaydediliyordu. `toISOString()` UTC'ye çevirir; oysa kullanıcı YEREL bir gün seçti.
 * İkisi, günün saatine ve saat dilimine göre farklı çıkar:
 *
 *   Türkiye (UTC+3), 3 Ağustos 01:30'da seçilen tarih  → "2026-08-02"  (bir gün GERİ)
 *   ABD Doğu (UTC−5), 3 Ağustos 20:30'da seçilen tarih → "2026-08-04"  (bir gün İLERİ)
 *
 * Yani sınav/mülakat/tez/spor tarihi yanlış güne yazılıyordu ve buna bağlı HER ŞEY
 * kayıyordu: geri sayım, "tarih geçti" kontrolü, plan uzunluğu, bildirim zamanı.
 * Türkiye'de dar bir pencere (00:00–03:00), ama saat dilimi büyüdükçe pencere büyüyor —
 * UTC+13'te günün yarısı. Uygulama İngilizce de sunduğu için bu gerçek bir risk.
 *
 * ── `fmtDateKey` İLE FARKI (ikisini karıştırmayın) ──────────────────────────────
 * `fmtDateKey` (useHabitStore) MANTIKSAL günü verir: 3 saatlik "gece kuşu" tamponu
 * içerir, çünkü gece 01:00'de yapılan alışkanlık dünün sayılmalıdır.
 *
 * Buradaki `toDateKey` ise TAKVİM gününü verir, tamponsuz: 3 Ağustos'a kurulan sınav
 * 3 Ağustos'tur — kullanıcının onu gece 01:00'de seçmiş olması tarihi değiştirmez.
 *
 * Kısaca: "bugün ne yaptım" → fmtDateKey · "hangi gün olacak" → toDateKey.
 */

/** Bir `Date`i YEREL takvim gününe göre 'YYYY-MM-DD' yapar. */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 'YYYY-MM-DD' anahtarını YEREL gece yarısına çevirir.
 *
 * ── NEDEN `new Date(key)` KULLANILMAZ ───────────────────────────────────────────
 * JavaScript, yalnız tarihten oluşan ISO metnini UTC gece yarısı sayar. Sonra
 * `getDate()` / `setHours()` YEREL saate göre okur. İkisi arasındaki fark, negatif
 * ofsetli saat dilimlerinde tarihi bir gün geri kaydırır:
 *
 *   new Date('2026-08-03')  →  İstanbul: 3 Ağustos 03:00  ✔
 *                              New York: 2 Ağustos 20:00  ✘ (bir gün geri)
 *
 * Türkiye'de doğru çalıştığı için hata burada görünmez; Amerika'daki bir kullanıcıda
 * geri sayım bir gün eksik çıkar, "tarih geçti" bir gün erken tetiklenir ve mod
 * vaktinden önce kapanır. Uygulama İngilizce de sunulduğu için bu gerçek bir senaryo.
 *
 * Sondaki saat bilgisi (varsa) atılır: bu fonksiyon TAKVİM gününü çözer.
 */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('T')[0].split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Bugünden `days` gün sonrasının yerel takvim anahtarı (varsayılan tarihler için). */
export function dateKeyFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/**
 * Bir görev tarihinin (`dueDate`) TAKVİM GÜNÜ — ya da tarihi yoksa `null`.
 *
 * ── NEDEN AYRI BİR OKUYUCU ──────────────────────────────────────────────────────
 * Görev tarihi uygulamada üç ayrı biçimde dolaşıyor ve bunları karıştırmak ölçülerek
 * gösterilmiş hatalar üretti (bkz. __tests__/taskBalancer.test.ts):
 *
 *   1. `'2026-09-19'`            — istemcinin yazdığı saf gün (form, `toDateKey`).
 *   2. `'2026-09-19T00:00:00Z'`  — AYNI günün sunucudan dönen hâli. Sunucu saf günü
 *      alıp UTC gece yarısı olarak saklıyor (bkz. TaskService.UpdateTaskAsync →
 *      `SpecifyKind(Utc)`) ve öyle geri veriyor.
 *   3. `'2026-09-18T22:30:00Z'`  — gerçek bir AN (ör. `new Date().toISOString()` ile
 *      kurulan hatırlatıcı). Bu, yerel saate çevrilince anlam kazanır: Türkiye'de
 *      19 Eylül 01:30'dur.
 *
 * Ayrıca sunucunun "tarih yok" değeri `'0001-01-01…'` (bkz. taskFilter). Onu gerçek bir
 * tarih saymak, görevi "2000 yıl gecikmiş" yapar.
 *
 * KURAL: Saf gün olduğu gibi alınır. Saati TAM UTC gece yarısı olan değer, sunucunun
 * saf günü sakladığı biçimdir → gün kısmı alınır (UTC'ye çevirmek negatif saat
 * dilimlerinde bir gün geri kaydırırdı). Başka her an YEREL güne çevrilir.
 */
export function calendarDayOf(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('0001')) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // Sunucunun saf-gün biçimi: T00:00:00 (salise ve 'Z' isteğe bağlı), başka ofset yok.
  const dateOnly = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?Z?$/.exec(value);
  if (dateOnly) return dateOnly[1];
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : toDateKey(d);
}
