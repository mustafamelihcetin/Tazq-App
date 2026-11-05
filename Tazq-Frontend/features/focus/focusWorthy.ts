/**
 * ODAK ÖNERİSİ NE ZAMAN ANLAMLI (madde 4; 2026-11-05 ters çevrildi, kullanıcı: "2+ litre su iç görevinde odaklan ne alaka; her göreve tek tek mi bakacağız, kaliteli çözüm lazım").
 *
 * Eski kural yasak listesiydi: yazılmayan her görevde düğme çıkıyordu, liste hiç bitmezdi. Şimdi varsayılan YOK, düğme kanıt ister. Yeni görev eklemek kod gerektirmez.
 * Kanıt iki yerden gelir, kelime kelime değil:
 *  1. Görevin hedefi: spor, bırakma, birikim, Ramazan işleri masa başı seans değildir, başlıkta "oku" ya da "yaz" geçse de.
 *  2. Cümlenin yüklemi: Türkçede fiil sondadır, İngilizcede başta. "Soru bankası temin et"in yüklemi "temin et"tir, içinde "soru" geçmesi onu çalışma yapmaz.
 *     Güçlü yüklem (çöz, oku, yaz, analiz et) tek başına yeter. Muğlak yüklem (hazırla, bitir, yap) ancak nesnesi işse sayılır: "sunum hazırla" evet, "kıyafet hazırla" hayır.
 * Yanlış gizleme ucuzdur: kullanıcı Odak ekranındaki listeden her işi yine seçebilir (bkz. canAttachFocus). Yanlış öneri ise uygulamayı robot gibi gösterir.
 */
export type TaskNature = 'deep' | 'doing' | 'allDay';

type FocusCandidate = { title: string; description?: string | null; tags?: string[] | null } | null | undefined;

const INSTANT_TAGS = new Set(['hatırlatıcı', 'reminder', 'etkinlik', 'event', 'not', 'note', 'weight_entry']);
/** Bu hedeflerin işi bedenle ya da gündelik hayatta yapılır. */
const LIFE_GOAL_TAG = /^(?:spor\d?|ramazan|tasarruf|birakma|fitness|health)$|^(?:kilo|maraton|guc|ramazan|spor)_/;
/** Hayat hedefinin içinde de açıkça çalışma denirse çalışmadır: "teravih sonrası 30 dk verimli çalışma". */
const EXPLICIT_STUDY = /verimli çalışma|focused study/iu;

const B = '(?:^|[^\\p{L}])';
const E = '(?=$|[^\\p{L}])';

/** Tek oturuşta bitmez, gün boyu tutulur. Sabah "bitti" denemez, ertelemek de anlamsızdır. */
const ALL_DAY = [
  `${B}su(?:yu|yunu)?${E}[^.]*${B}iç(?:in|meyi)?${E}`, `${B}\\d*\\+?\\s*litre`, `${B}\\d+\\+?\\s*l${E}`, `${B}liters?${E}`, `${B}litres?${E}`, `${B}drink\\s+(?:water|a\\s+glass)`,
  `kaçın`, `${B}avoid${E}`, `${B}skip\\s+(?:sugary|caffeine)`, `önceliklendir`, `öncelikli`, `prioriti[sz]e`,
  `hedefle${E}`, `${B}aim\\s+for`, `protein hedef`, `protein target`,
  `${B}uyku\\p{L}*`, `${B}uyumayı`, `erken uyu`, `${B}sleep${E}`, `${B}bedtime`, `bed\\s+early`,
  `kafein`, `caffeine`, `ekranı bırak`, `screens?\\s+away`,
  `istek gelince`, `^when\\s+a\\s+craving`, `24 saat bekle`, `wait\\s+24\\s+hours`,
].map(p => new RegExp(p, 'iu'));
const NAP = /kısa uyku|(?:^|[^\p{L}-])nap(?=$|[^\p{L}])|minute\s+nap/iu;

/** Bir cümlelik iş seans istemez. */
const TOO_SHORT = /(?:tek|bir|iki|[1-3])\s+cümle|cümlesi|kısaca|eğer-ise|if-then|(?:one|two|[1-3])[\s-]+(?:line|sentence)|briefly/iu;

// Türkçe: cümlenin SON sözcüğü.
const TR_STRONG = new Set([
  'çöz', 'çözüm', 'çözümü', 'çözme', 'çözmesi', 'çözümleri', 'oku', 'okuma', 'okuması', 'özetle', 'özetleme', 'yaz', 'yazma', 'yazımı', 'yazım', 'çalış', 'çalışması', 'çalışma', 'ezberle', 'ezber', 'öğren', 'öğrenme',
  'araştır', 'araştırması', 'incele', 'düzelt', 'taslakla', 'taslak', 'tekrarla', 'tekrar', 'tekrarı', 'analiz', 'analizi', 'pratik', 'pratiği', 'prova', 'provası', 'tasarla', 'revizyon', 'revizyonu', 'soru', 'sorular', 'soruları', 'simülasyonu', 'denemesi', 'dinle', 'konuş', 'pekiştir', 'güçlendir', 'odaklan', 'karşılaştır', 'anki',
]);
const TR_STRONG_TWO = new Set(['tekrar et', 'analiz et', 'prova et', 'gözden geçir', 'revize et', 'test et', 'pratik yap', 'temize çek']);
const TR_NEEDS_OBJECT = new Set(['hazırla', 'çıkar', 'tamamla', 'bitir', 'güncelle', 'yap', 'ekle', 'kur', 'ayır', 'oluştur', 'ilerlet', 'böl', 'çiz', 'listele', 'uygula', 'sırala', 'kontrol et', 'tanımla', 'anlat', 'başla', 'topla', 'çek']);
const TR_WORK_OBJECT = /ödev|sunum|slayt|rapor|bölüm|proje|tez|cevap|soru|hikaye|özet|cv|konu|kavram|şartname|makale|literatür|araştırma|analiz|deneme|mülakat|repo|kod|müfredat|kart|paragraf|anahat|ana hat|grafik|tablo|bulgu|veri|revizyon|taslak|\d+\s+not|beceri|problem|yanlış|anki|kelime|formül|atıf|kaynakça|outline|başlık|\bnot(?:u|unu|ları|lar)\b|çalışma|pomodoro|ilerleme|kağıd|kâğıd/iu;

// İngilizce: cümlenin İLK sözcüğü.
const EN_STRONG = new Set(['solve', 're-solve', 'read', 'write', 'rewrite', 'study', 'review', 'practice', 'practise', 'revise', 'draft', 'research', 'analyze', 'analyse', 'rehearse', 'summarise', 'summarize', 'learn', 'memorize', 'memorise', 'edit', 'code', 'outline', 'proofread', 'test', 're-test', 'redraw', 'clean', 'revisit', 'listen', 'speak', 'strengthen', 'drill', 'reinforce', 'memorise', 'compare']);
const EN_NEEDS_OBJECT = new Set(['do', 'prepare', 'complete', 'finish', 'update', 'add', 'build', 'create', 'set', 'make', 'map', 'list', 'split', 'spend', 'focus', 'take', 'work', 'explain', 'check', 'apply', 'order', 'start', 'close', 'finish', 'clear', 'one', 'no']);
const EN_WORK_OBJECT = /homework|presentation|slide|report|chapter|section|project|thesis|answer|question|story|summary|resume|\bcv\b|topic|concept|paper|literature|research|analysis|mock|repo|\bcode\b|syllabus|\bcards?\b|paragraph|outline|chart|table|finding|\bdata\b|revision|draft|\d+\s+notes|skills|problem|mistake|block|essay|\bcase\b|anki|\bwords?\b|vocab|formula|reference|citation|heading|note|pomodoro|progress/iu;

const clausesOf = (title: string) => title
  .toLocaleLowerCase('tr')
  .split(/[,:;—–·&()→+\n]|\s\/\s|\sve\s|\sand\s|\sthen\s/u)
  .map(c => c.replace(/[^\p{L}\p{N}\s/'’-]/gu, ' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean);

function clauseIsWork(clause: string): boolean {
  if (TOO_SHORT.test(clause)) return false;
  const words = clause.split(' ');
  const last = words[words.length - 1];
  const lastTwo = words.slice(-2).join(' ');
  const first = words[0];
  if (TR_STRONG.has(last) || TR_STRONG_TWO.has(lastTwo) || EN_STRONG.has(first)) return true;
  if ((TR_NEEDS_OBJECT.has(last) || TR_NEEDS_OBJECT.has(lastTwo)) && TR_WORK_OBJECT.test(clause)) return true;
  return EN_NEEDS_OBJECT.has(first) && EN_WORK_OBJECT.test(clause);
}

/** İki dilli görevde iki başlık ayrı ayrı okunur: yüklem yerini ararken birbirine karışmazlar. */
function titlesOf(task: NonNullable<FocusCandidate>): string[] {
  const d = task.description;
  if (d && d.startsWith('{"tr":')) {
    try { const p = JSON.parse(d); return [p.tr, p.en].filter(Boolean); } catch { /* düz başlığa düş */ }
  }
  return [task.title ?? ''];
}

export function taskNature(task: FocusCandidate): TaskNature {
  if (!task) return 'deep';
  const tags = task.tags ?? [];
  if (tags.some(t => t.startsWith('sb_'))) return 'deep'; // çalışma takvimi bloğu
  if (tags.some(t => INSTANT_TAGS.has(t.toLowerCase()))) return 'doing';
  const titles = titlesOf(task);
  if (titles.some(t => EXPLICIT_STUDY.test(t))) return 'deep';
  if (titles.some(t => NAP.test(t))) return 'doing';
  if (titles.some(t => ALL_DAY.some(re => re.test(t)))) return 'allDay';
  if (tags.some(t => LIFE_GOAL_TAG.test(t))) return 'doing';
  return titles.some(t => clausesOf(t).some(clauseIsWork)) ? 'deep' : 'doing';
}

/** Düğme yalnız kanıt varsa önerilir. */
export const isFocusWorthy = (task: FocusCandidate): boolean => taskNature(task) === 'deep';

/** Kullanıcı Odak ekranında kendisi seçiyorsa karışmayız: öneri kapalı olsa da seçebilir. Yalnız gün boyu işler ve hatırlatıcılar seansa bağlanamaz. */
export const canAttachFocus = (task: FocusCandidate): boolean => {
  if (!task) return true;
  if ((task.tags ?? []).some(t => INSTANT_TAGS.has(t.toLowerCase()))) return false;
  return taskNature(task) !== 'allDay';
};
