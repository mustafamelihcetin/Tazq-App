/**
 * BİTEN HEDEFİN İZİ.
 *
 * ── ÖLÇÜLEN SORUN ──────────────────────────────────────────────────────────
 * Üç ay çalışılıp kapatılan hedef ekrandan siliniyordu. Birkaç saniyelik geri alma
 * tostu dışında hiçbir iz kalmıyordu: "geçmiş hedeflerim" diye bir yer yoktu.
 * Uygulamanın kullanıcıya "şunu başardın" diyebileceği en güçlü an buydu ve tam da
 * orada elindeki her şeyi atıyordu.
 *
 * ── NEDEN AYRI BİR KAYIT ───────────────────────────────────────────────────
 * Kapanan planın görevleri emekliye ayrılıyor, alışkanlıkları kullanıcının kendi
 * listesinde kalabiliyor; yani geçmişi sonradan HESAPLAMAK mümkün değil. Kapanış
 * anında ölçülen sayılar (kaç gün sürdü, kaç gününde çalışıldı) o an yazılmazsa
 * bir daha bulunamaz. Kayıt bu yüzden bir özet — planın kopyası değil.
 *
 * Liste sınırlı (`MAX_GOAL_HISTORY`): tercihler buluta bir bütün olarak taşınıyor,
 * sınırsız büyüyen bir dizi orayı zamanla şişirirdi.
 */

export const MAX_GOAL_HISTORY = 30;

export interface GoalRecord {
  /** Kayıt kimliği — geri almada aynı kaydı bulmak için. */
  id: string;
  /** Plan yuvası ('exam', 'spor2', …) — ikon/renk bundan çözülür. */
  mode: string;
  name: string;
  emoji: string;
  /** Planın başladığı gün. Eski planlarda bilinmiyor olabilir. */
  startKey: string | null;
  /** Kapatıldığı gün. */
  closedKey: string;
  /** Hedef tarihi (varsa). */
  targetKey: string | null;
  /** Kaç gün sürdü (bugün dahil). Başlangıç bilinmiyorsa null. */
  days: number | null;
  /** Kaç gününde plana ait bir alışkanlık tamamlandı. Bilinmiyorsa null. */
  effortDays: number | null;
}

export function makeGoalId(mode: string, closedKey: string, now: number): string {
  return `${mode}-${closedKey}-${now}`;
}

/** Bir yuvanın adı/tarihi `seasonal` içinde hangi alanlarda durur. */
const SLOT_FIELDS: Record<string, { name: string; date?: string; emoji: string }> = {
  exam:      { name: 'examName',      date: 'examDate',      emoji: '🎯' },
  exam2:     { name: 'exam2Name',     date: 'exam2Date',     emoji: '🎯' },
  exam3:     { name: 'exam3Name',     date: 'exam3Date',     emoji: '🎯' },
  tez:       { name: 'tezName',       date: 'tezDate',       emoji: '📚' },
  mulakat:   { name: 'mulakatName',   date: 'mulakatDate',   emoji: '💼' },
  mulakat2:  { name: 'mulakat2Name',  date: 'mulakat2Date',  emoji: '💼' },
  mulakat3:  { name: 'mulakat3Name',  date: 'mulakat3Date',  emoji: '💼' },
  spor:      { name: 'sporGoal',      date: 'sporDate',      emoji: '💪' },
  spor2:     { name: 'spor2Goal',     date: 'spor2Date',     emoji: '💪' },
  spor3:     { name: 'spor3Goal',     date: 'spor3Date',     emoji: '💪' },
  tasarruf:  { name: 'tasarrufName',  date: 'tasarrufDate',  emoji: '💰' },
  birakma:   { name: 'birakmaName',                          emoji: '🚫' },
  ramazan:   { name: '',                                     emoji: '🌙' },
};

/**
 * Adı kullanıcının YAZMADIĞI modlar için sözlükten gelen ad.
 *
 * Ramazan'ın `seasonal`da adı yoktur (kullanıcı bir ad girmez, mod takvimden gelir);
 * bu yüzden kapanışta kaydı adsız kalıyor ve geçmişe HİÇ düşmüyordu — üç mod kullanan
 * kişinin yalnız ikisi iz bırakıyordu. Tasarruf ve bırakmada ad isteğe bağlı, onlar da
 * boş geçilebiliyor.
 */
export function fallbackNameFor(mode: string, names: { ramadan: string; savings: string; quit: string }): string {
  if (mode === 'ramazan') return names.ramadan;
  if (mode === 'tasarruf') return names.savings;
  if (mode === 'birakma') return names.quit;
  return '';
}

/**
 * Kapanan yuvanın adını, hedef tarihini ve simgesini `seasonal`dan okur.
 *
 * Eşleme burada, saf bir sözlükte: kapanış anında her kartın kendi alan adlarını
 * bilmesi gerekmiyor ve yeni bir yuva eklendiğinde tek bir yerde güncelleniyor.
 */
export function describeSlot(
  mode: string,
  seasonal: Record<string, unknown>,
  fallbackName = '',
): { name: string; targetKey: string | null; emoji: string } {
  const f = SLOT_FIELDS[mode];
  if (!f) return { name: fallbackName, targetKey: null, emoji: '🎯' };
  const raw = f.name ? seasonal[f.name] : '';
  const name = (typeof raw === 'string' && raw.trim()) || fallbackName;
  const dateRaw = f.date ? seasonal[f.date] : null;
  const targetKey = typeof dateRaw === 'string' && dateRaw ? dateRaw.split('T')[0] : null;
  return { name, targetKey, emoji: f.emoji };
}

/** En yeni başta; liste sınırı aşılırsa en eskiler düşer. */
export function addGoalRecord(list: GoalRecord[], rec: GoalRecord): GoalRecord[] {
  return [rec, ...list.filter(r => r.id !== rec.id)].slice(0, MAX_GOAL_HISTORY);
}

/** Kapatmayı geri alan kullanıcı, geçmişte de o kaydı görmemeli. */
export function removeGoalRecord(list: GoalRecord[], id: string): GoalRecord[] {
  return list.filter(r => r.id !== id);
}
