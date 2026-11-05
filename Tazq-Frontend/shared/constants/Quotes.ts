import { stripEmoji } from '@/shared/utils/emoji';
/*
  ODAK EKRANININ ALT SATIRI — TELKİN ve MOTİVASYON ayrı (2026-11-01, kullanıcı: "yazılar yeterli ve anlamlı mı?
  çeviri değil yerelleştirme · kişiye göre olabilir mi · motivasyon ve telkini ayrı ayrı düşünelim").

  · TELKİN — ŞİMDİ'ye ve bedene dönük: sakinleştirir, dikkati toplar. Seans SÜRERKEN ve MOLADA. Her cümlenin
    sahnesi (bkz. QuoteScene) cümlenin anlattığını gösterir. Çalan ses varsa o sese ait cümle havuza girer;
    gece geç saatte "kısa tut" cümlesi.
  · MOTİVASYON — NEDEN'e ve ilerlemeye dönük; YALNIZ ÖLÇÜLEN VERİYLE konuşur (bugünkü odak, hedef, seri,
    bugünün kaçıncı seansı, seçili görev). Seans BAŞLAMADAN ve SON İKİ DAKİKADA. Uydurma sayı yok.
  · Seçim rastgele değil DURUMDAN: o an geçerli cümleler arasından, aşama değişince bir kez seçilir
    (saniyede bir değişmez).
  · İki dil birbirinin ÇEVİRİSİ DEĞİL: her biri kendi dilinde, kendi deyimleriyle yazıldı.
*/

/** Cümleye eşlik eden küçük sahne (bkz. QuoteScene) — cümlenin anlattığı şey görünür. */
export type QuoteKind = 'breath' | 'cloud' | 'rain' | 'door' | 'ground' | 'step' | 'wave' | 'sun' | 'page' | 'bell' | 'still' | 'mountain';
export type LineKind = 'suggestion' | 'motivation';
export interface FocusQuote { t: string; k: QuoteKind; kind: LineKind }

export type FocusPhase = 'idle' | 'focus' | 'final' | 'break';
export type SoundId = 'off' | 'rain' | 'wind' | 'forest' | 'ocean' | 'fireplace' | 'cafe' | 'relaxing' | 'binaural' | 'brown';

export interface FocusLineContext {
  phase: FocusPhase;
  task?: string | null;
  sound?: SoundId;
  hour: number;
  todayMin: number;
  goalMin: number;
  streak: number;
  /** Bugün kaydedilmiş seans sayısı (bu seans hariç). */
  sessionsToday: number;
  /** En yakın aktif hedef (sınav, tez, mülakat, spor) — motivasyon cümlesi onu adıyla anar. */
  goal?: { name: string; days: number } | null;
  /** Bu seansın dakikası — son dakikalarda "bu seansla bugün N dk" der. */
  sessionMin?: number;
}

type Lang = 'tr' | 'en';
type Line = [string, QuoteKind];

const clip = (s: string) => (s.length > 28 ? `${s.slice(0, 27).trimEnd()}…` : s);

const SUGGEST: Record<Lang, { focus: Line[]; sound: Partial<Record<SoundId, Line>>; night: Line; rest: Line[] }> = {
  tr: {
    focus: [
      ['Omuzlarını indir, nefesini uzat. Önünde yalnız bu iş var.', 'breath'],
      ['Aklına başka bir şey düşerse bırak, geçsin. Sayfaya dön.', 'cloud'],
      ['Bildirimler kapının dışında. Bu süre yalnız senin.', 'door'],
      ['Ayaklarını yere bas. Buradasın, bu yeterli.', 'ground'],
      ['Takıldıysan zorlama; son satırı yeniden oku.', 'page'],
      ['Telefon yüzüstü, masa sakin. Zihnin de duruluyor.', 'still'],
    ],
    sound: {
      rain: ['Bırak yağsın. Sen bu sayfadasın.', 'rain'],
      ocean: ['Dalga gelip gidiyor; sen yerindesin.', 'wave'],
      wind: ['Rüzgâr esiyor, sen kımıldamadan devam ediyorsun.', 'cloud'],
      forest: ['Kuşlar kendi işinde, sen kendi işinde.', 'ground'],
      fireplace: ['Ateş çıtırdıyor, zaman yavaşlıyor.', 'still'],
      cafe: ['Kafe uğulduyor; senin masan sakin.', 'still'],
    },
    night: ['Gece sessiz. Kısa tut, sonra dinlen.', 'still'],
    rest: [
      ['Ekrandan uzaklaş, bir bardak su iç.', 'rain'],
      ['Gözlerini kapat, omuzlarını bırak.', 'breath'],
      ['Kalk, biraz esne. İş seni bekler.', 'ground'],
    ],
  },
  en: {
    focus: [
      ['Drop your shoulders. Lengthen the exhale. Just this, right now.', 'breath'],
      ['If something else pops up, let it drift by. Back to the page.', 'cloud'],
      ['Notifications can wait outside. This time is yours.', 'door'],
      ['Feet flat on the floor. You’re here, and that’s enough.', 'ground'],
      ['Stuck? Don’t force it. Reread the last line.', 'page'],
      ['Phone face down, desk clear. Let your mind settle.', 'still'],
    ],
    sound: {
      rain: ['Let it rain. You’re on this page.', 'rain'],
      ocean: ['Waves come and go. You stay put.', 'wave'],
      wind: ['The wind keeps moving. You don’t have to.', 'cloud'],
      forest: ['The birds are busy. So are you.', 'ground'],
      fireplace: ['The fire crackles. Time slows down.', 'still'],
      cafe: ['The café hums. Your table stays quiet.', 'still'],
    },
    night: ['It’s late. Keep it short, then get some rest.', 'still'],
    rest: [
      ['Step away from the screen. Grab some water.', 'rain'],
      ['Close your eyes. Let your shoulders drop.', 'breath'],
      ['Get up and stretch. The work will keep.', 'ground'],
    ],
  },
};

/** Genel motivasyon — hedefe/veriye bağlı değil; başlamadan ve seans arasında araya girer (2026-11-01). */
const GENERAL: Record<Lang, Line[]> = {
  tr: [
    ['Büyük işler, sıradan günlerde atılan küçük adımlardan oluşur.', 'step'],
    ['Mükemmel olması gerekmiyor; başlaması yeter.', 'sun'],
    ['Her seans, olmak istediğin kişiye verilmiş bir oy.', 'sun'],
    ['En zor adım başlamak; gerisi arkasından gelir.', 'ground'],
    ['Yavaş ilerlemek, hiç ilerlememekten iyidir.', 'mountain'],
    ['Bugün yaptığın, yarın teşekkür edeceğin şey.', 'sun'],
  ],
  en: [
    ['Big things are built from small steps on ordinary days.', 'step'],
    ['It doesn’t have to be perfect. It just has to start.', 'sun'],
    ['Every session is a vote for who you want to become.', 'sun'],
    ['Starting is the hardest step; the rest follows.', 'ground'],
    ['Slow progress still beats standing still.', 'mountain'],
    ['What you do today, tomorrow will thank you for.', 'sun'],
  ],
};

const MOTIVATE = {
  tr: {
    task: (t: string): Line => [`Sıradaki: ${t}. Gerisi bekleyebilir.`, 'step'],
    goalDone: (): Line => ['Bugünün hedefi tamam. Bu seans sana ekstra.', 'sun'],
    goalLeft: (m: number, left: number): Line => [`Bugün ${m} dk odaklandın; hedefe ${left} dk kaldı.`, 'step'],
    streak: (n: number): Line => [`${n} gündür her gün odaklanıyorsun. Zinciri bugün de sürdür.`, 'step'],
    nth: (n: number): Line => [`Bugünün ${n}. seansı. Ritmi buldun.`, 'step'],
    first: (): Line => ['Günün ilk odağı. Yavaş başla; ısındıkça derinleşir.', 'sun'],
    any: (): Line => ['Bir seans, tek iş. Başlayınca kolaylaşır.', 'sun'],
    final: (): Line => ['Az kaldı. Çan çalınca kalkarsın.', 'bell'],
    finalTotal: (n: number): Line => [`Az kaldı. Bu seansla bugün ${n} dk olacak.`, 'bell'],
    goal: (name: string, d: number): Line => [d === 0 ? `${name} bugün. Bu seans son hazırlığın.` : `${name} için ${d} gün kaldı. Bugünkü seans o yolun bir adımı.`, 'mountain'],
    finalTask: (t: string): Line => [`Son dakikalar. ${t} bitişe çok yakın.`, 'bell'],
  },
  en: {
    task: (t: string): Line => [`Up next: ${t}. Everything else can wait.`, 'step'],
    goalDone: (): Line => ['Today’s goal is done. This one’s a bonus.', 'sun'],
    goalLeft: (m: number, left: number): Line => [`${m} min of focus today, ${left} to go.`, 'step'],
    streak: (n: number): Line => [`${n} days in a row. Keep the chain going.`, 'step'],
    nth: (n: number): Line => [`Session ${n} today. You’ve found your rhythm.`, 'step'],
    first: (): Line => ['First focus of the day. Ease in; depth comes once you’re warm.', 'sun'],
    any: (): Line => ['One session, one task. It gets easier once you start.', 'sun'],
    final: (): Line => ['Almost there. Stand up when the bell rings.', 'bell'],
    finalTotal: (n: number): Line => [`Almost there. This session brings today to ${n} min.`, 'bell'],
    goal: (name: string, d: number): Line => [d === 0 ? `${name} is today. This session is your last prep.` : `${d} days to ${name}. Today’s session is one step on that road.`, 'mountain'],
    finalTask: (t: string): Line => [`Final stretch. ${t} is nearly done.`, 'bell'],
  },
};

/** O an geçerli cümleler (aday listesi) — test edilebilir, saf. */
export function focusLineCandidates(c: FocusLineContext, lang: Lang): FocusQuote[] {
  const S = SUGGEST[lang];
  const M = MOTIVATE[lang];
  const task = c.task?.trim() ? clip(c.task.trim()) : null;
  const sug = (l: Line): FocusQuote => ({ t: l[0], k: l[1], kind: 'suggestion' });
  const mot = (l: Line): FocusQuote => ({ t: l[0], k: l[1], kind: 'motivation' });
  const night = c.hour >= 23 || c.hour < 5;

  if (c.phase === 'break') return S.rest.map(sug);
  if (c.phase === 'final') {
    // Somut sayı varsa onu söyle ("bu seansla bugün 75 dk"); yoksa görevle, o da yoksa genel.
    if (c.sessionMin && c.sessionMin > 0) return [mot(M.finalTotal(c.todayMin + c.sessionMin))];
    return [mot(task ? M.finalTask(task) : M.final())];
  }
  if (c.phase === 'focus') {
    const out = S.focus.map(sug);
    const snd = c.sound && c.sound !== 'off' ? S.sound[c.sound] : undefined;
    if (snd) out.unshift(sug(snd), sug(snd)); // çalan sesin cümlesi daha olası
    if (night) out.unshift(sug(S.night));
    // Seans sırasında da ara ara genel motivasyon (telkinlerle karışık; iki tane, havuzu ezmesin).
    const g = GENERAL[lang];
    out.push(mot(g[(c.sessionsToday + c.hour) % g.length]), mot(g[(c.sessionsToday + c.hour + 3) % g.length]));
    return out;
  }
  // idle — motivasyon, yalnız gerçek veriyle
  const out: FocusQuote[] = [];
  if (task) out.push(mot(M.task(task)));
  if (c.goal && c.goal.days >= 0 && c.goal.days <= 365) out.push(mot(M.goal(clip(stripEmoji(c.goal.name)), c.goal.days)));
  if (c.goalMin > 0 && c.todayMin >= c.goalMin) out.push(mot(M.goalDone()));
  else if (c.goalMin > 0 && c.todayMin > 0) out.push(mot(M.goalLeft(c.todayMin, c.goalMin - c.todayMin)));
  if (c.streak >= 2) out.push(mot(M.streak(c.streak)));
  if (c.sessionsToday >= 2) out.push(mot(M.nth(c.sessionsToday + 1)));
  if (c.sessionsToday === 0 && c.todayMin === 0) out.push(mot(M.first()));
  if (!out.length) out.push(mot(M.any()));
  // Hep veriye/moda bağlı olmasın: genel motivasyon da adaylarda.
  for (const l of GENERAL[lang]) out.push(mot(l));
  return out;
}

/** Adaylardan biri; `seed` aşama değişince yenilenir (0..1). */
export function pickFocusLine(c: FocusLineContext, lang: Lang, seed: number): FocusQuote {
  const list = focusLineCandidates(c, lang);
  return list[Math.min(list.length - 1, Math.floor(seed * list.length))];
}
