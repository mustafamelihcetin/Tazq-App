/**
 * GÖREV METİN SINIRLARI — TEK YER (2026-11-01, kullanıcı: "ideal karakter sayısına kadar izin
 * verilmeli, detayı aşağı girsin; onun da sınırı olacak").
 *
 *  · title 100: sunucunun sınırı (TaskRequestDtoValidator). Listede kapalıyken tek satır, açılınca
 *    tamamı görünür; 100 karakter iki-üç satırlık, okunur bir başlıktır.
 *  · titleHint 80: buradan sonra sayaç ve "ayrıntıları nota yaz" ipucu çıkar — sınıra çarpmadan önce.
 *  · description 1000: bir paragraf ayrıntı. Sunucuda da aynı kural (eskiden formda 500, sunucuda yoktu).
 *  · descriptionHint 900: notun sayacı buradan sonra görünür.
 */
export const TASK_LIMITS = { title: 100, titleHint: 80, description: 1000, descriptionHint: 900 } as const;
