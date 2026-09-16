export interface DayCell {
  day: string;
  minutes: number;
  tasksCompleted: number;
}

/**
 * HAFTALIK ŞERİT — her zaman TAM YEDİ gün.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Şerit doğrudan sunucudan gelen diziye bağlıydı (`stats.weeklyFocus || []`) ve o
 * dizinin uzunluğu hiçbir yerde garanti edilmiyordu. İki ayrı kod yolu vardı:
 *
 *   · Dizi BOŞSA  → yedi boş hücre kuruluyor, bugünün yerel dakikası ekleniyordu.
 *   · Dizi DOLUYSA → olduğu gibi kullanılıyor, yalnız bugünün hücresi güncelleniyordu.
 *
 * Arada bir durum daha var ve o hiç düşünülmemişti: dizi DOLU AMA KISA. O zaman
 * `weeklyFocus[todayIndex]` tanımsız kalıyor, bugünün yerel odak dakikası hiçbir
 * hücreye yazılamıyor ve SESSİZCE kayboluyordu — yalnız grafikten değil,
 * `weeklyMinutes` üzerinden İVME SKORUNDAN da.
 *
 * Arayüz kullanıcıya bir HAFTA söz veriyor; o sözü sunucunun cevabına bırakmak yerine
 * burada tutuyoruz. Tek kod yolu: yedi hücre kurulur, elde ne varsa üzerine oturur.
 */
export function buildWeekStrip(input: {
  /** Sunucudan gelen hafta (eksik, fazla ya da boş olabilir). */
  weeklyFocus: Partial<DayCell>[] | null | undefined;
  /** Yedi günün görünen adları (Pazartesi'den başlar). */
  dayLabels: string[];
  /** Bugünün sütunu — ürünün gün tanımına göre (bkz. streakDay → weekdayIndex). */
  todayIndex: number;
  /** Cihazda biriken, henüz sunucuya yansımamış dakika. */
  todayMinutes: number;
}): DayCell[] {
  const { weeklyFocus, dayLabels, todayIndex, todayMinutes } = input;
  const src = weeklyFocus ?? [];

  return Array.from({ length: 7 }, (_, i) => {
    const cell = src[i];
    const serverMinutes = cell?.minutes ?? 0;
    /*
      Bugün için BÜYÜK olan kazanır: sunucu henüz bu seansı görmemiş olabilir ama
      görmüşse de geri gitmemeli. Öteki günlerde yerel sayacın söyleyeceği bir şey yok.
    */
    const minutes = i === todayIndex ? Math.max(serverMinutes, todayMinutes) : serverMinutes;
    return {
      day: cell?.day ?? dayLabels[i] ?? '',
      minutes,
      tasksCompleted: cell?.tasksCompleted ?? 0,
    };
  });
}
