/**
 * Alışkanlık adı yardımcıları — SAF metin işlemleri, bileşen bağımlılığı yok.
 *
 * `compactHabitLabel` bir süre HabitBubble.tsx'in içinde yaşadı; oraya konmasının
 * sebebi tek kullanıcısının o olmasıydı. Artık ikinci bir kullanıcısı var
 * (bkz. sleepHabit.ts) ve o bir store/hook katmanı — saf bir string fonksiyonu için
 * bir React bileşeni dosyasını içeri almak zorunda kalmamalı.
 */

/**
 * Adın KİMLİĞİNİ döndürür, açıklamasını atar.
 *
 * Alışkanlık adlarının bir kısmı iki iş birden yapıyor: ad + koçluk detayı
 * ("Düzenli uyku (7–9 saat) — kas onarımı için kritik"). Kimlik baştaki parçadır;
 * parantez ve boşluklu uzun tire açıklamayı başlatır.
 *
 * Bkz. __tests__/habitLabel.test.ts
 */
export function compactHabitLabel(title?: string | null): string {
  // Başlık boş/tanımsız gelebiliyor (çevrimdışı kuyruktaki geçici kayıtlar, eksik
  // çeviri). Eskiden `{item.title}` sessizce boş çiziyordu; kırpma eklenince aynı veri
  // çökmeye başladı. Bileşen bir veri boşluğu yüzünden ekranı düşürmemeli.
  if (!title) return '';
  const head = title.split(/\s+[—–]\s+|\s*\(/)[0].trim();
  return head.length >= 3 ? head : title;
}
