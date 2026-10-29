/**
 * ODAKLANILABİLİR Mİ? (madde 4)
 *
 * "Odaklan" her görevin yanında çıkıyordu — "Su iç" ve "Tartıl" için de. Saniyelik bir
 * eyleme 25 dakikalık zamanlayıcı önermek düğmenin anlamını öldürür: kullanıcı onu
 * görmezden gelmeyi öğrenir, gerçekten gereken yerde de görmez.
 *
 * Karar sırası:
 *  1. Yapı: hatırlatıcı/etkinlik/not etiketi ya da kilo girişi → anlık.
 *  2. Dil: başlıkta bilinen anlık eylem kalıbı (su iç, tartıl, ilaç, öde, ara…) → anlık.
 *  3. Aksi hâlde odaklanılabilir — şüphede düğme KALIR (gizlemek, göstermekten pahalı hata).
 *
 * Kalıplar fiil KÖKÜNE bağlı ve sözcük sınırlı: "Ara" (telefon) eşleşir, "Araştırma"
 * eşleşmez; "öde" eşleşir, "ödev" eşleşmez.
 */

type FocusCandidate = { title: string; description?: string | null; tags?: string[] | null } | null | undefined;

const INSTANT_TAGS = new Set(['hatırlatıcı', 'reminder', 'etkinlik', 'event', 'not', 'note', 'weight_entry']);

// Türkçe ekler için kök + isteğe bağlı ek; \b Türkçe harflerde güvenilmez, sınır elle.
const B = '(?:^|[^\\p{L}])';
const E = '(?=$|[^\\p{L}])';
const INSTANT = [
  // su iç / suyunu iç / 2 litre su iç
  `${B}su(?:yu|yunu)?${E}[^.]*${B}iç(?:in|meyi)?${E}`,
  `${B}tart(?:ıl|ı)${E}`, `${B}tartıl\\p{L}*`, `${B}kilo(?:nu|yu)?\\s+(?:gir|ölç)`,
  `${B}ilac(?:ını|ı)|${B}ilaç${E}`, `${B}vitamin\\p{L}*\\s+al`,
  `${B}öde${E}`,
  `${B}ara${E}\\s*$`,
  `${B}drink\\s+(?:water|a\\s+glass)`, `${B}weigh(?:\\s|-)?in${E}`, `${B}weigh\\s+yourself`,
  `${B}take\\s+(?:your\\s+)?(?:pills?|meds|medicine|vitamins?)`, `${B}pay${E}`, `${B}call${E}`,
].map(p => new RegExp(p, 'iu'));

function readableTitle(task: NonNullable<FocusCandidate>): string {
  const d = task.description;
  if (d && d.startsWith('{"tr":')) {
    try { const p = JSON.parse(d); return `${p.tr ?? ''} ${p.en ?? ''}`; } catch { /* düz başlığa düş */ }
  }
  return task.title ?? '';
}

export function isFocusWorthy(task: FocusCandidate): boolean {
  if (!task) return true;
  if ((task.tags ?? []).some(tag => INSTANT_TAGS.has(tag.toLowerCase()))) return false;
  const title = readableTitle(task).toLocaleLowerCase('tr');
  return !INSTANT.some(re => re.test(title));
}
