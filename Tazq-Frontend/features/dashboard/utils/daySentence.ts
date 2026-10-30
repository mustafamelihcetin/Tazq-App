/**
 * YAŞAYAN CÜMLE — ana sayfa "Bugün" alanının kalbi (2026-10-30).
 *
 * Halkalar ("renkler çirkin, bakınca anlaşılmıyor") ve ölçerler ("demode") reddedildi;
 * kullanıcı: "grafik şart değil, daha geniş düşün". Ekranın 2 saniyede söylemesi gereken
 * şey bir grafik değil, bir CÜMLE: "Bugün seni 3 görev, 90 dk odak ve 1 alışkanlık bekliyor."
 * Cümle duruma göre kendini yeniden kurar; içindeki ölçüler dokunulabilir HAP'tır.
 *
 *  · bugün, hepsi bekliyor  → "Bugün seni ⟨3 görev⟩, ⟨90 dk odak⟩ ve ⟨1 alışkanlık⟩ bekliyor."
 *  · biri bitti             → "⟨✓ Görevler⟩ tamam; ⟨65 dk odak⟩ ve ⟨1 alışkanlık⟩ kaldı."
 *  · hepsi bitti            → "Günü kapattın: ⟨✓ görevler⟩ ⟨✓ odak⟩ ⟨✓ alışkanlıklar⟩"
 *  · hiçbir hedef yok       → "Bugün için planın boş."
 *  · geçmiş gün             → "⟨2 görev⟩ bitirdin, ⟨45 dk⟩ odaklandın, ⟨1 alışkanlık⟩ yaptın."
 * Hapta KALAN miktar yazar (bekleyen bir gün için anlamlı olan budur), geçmişte YAPILAN.
 */
export type DayKind = 'tasks' | 'focus' | 'habits';
export interface DayMetric { kind: DayKind; done: number; total: number }
export type Segment = { t: 'text'; s: string } | { t: 'token'; kind: DayKind; s: string; done: boolean };

type Lang = 'tr' | 'en';

const W = {
  tr: {
    rem: { tasks: (n: number) => `${n} görev`, focus: (n: number) => `${n} dk odak`, habits: (n: number) => `${n} alışkanlık` },
    did: { tasks: (n: number) => `${n} görev`, focus: (n: number) => `${n} dk`, habits: (n: number) => `${n} alışkanlık` },
    doneTok: { tasks: 'Görevler', focus: 'Odak', habits: 'Alışkanlıklar' },
    pastVerb: { tasks: 'bitirdin', focus: 'odaklandın', habits: 'yaptın' },
    and: 've', waiting: 'bekliyor.', left: 'kaldı.', done: 'tamam;', today: 'Bugün seni',
    closed: 'Günü kapattın:', empty: 'Bugün için planın boş.', pastEmpty: 'Bu gün kayıt yok — dinlenme günü.',
  },
  en: {
    rem: { tasks: (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`, focus: (n: number) => `${n} min focus`, habits: (n: number) => `${n} ${n === 1 ? 'habit' : 'habits'}` },
    did: { tasks: (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`, focus: (n: number) => `${n} min`, habits: (n: number) => `${n} ${n === 1 ? 'habit' : 'habits'}` },
    doneTok: { tasks: 'Tasks', focus: 'Focus', habits: 'Habits' },
    pastVerb: { tasks: 'done', focus: 'of focus', habits: 'kept' },
    and: 'and', waiting: 'waiting today.', left: 'left.', done: 'done;', today: 'You have',
    closed: 'Day closed:', empty: 'Nothing planned for today.', pastEmpty: 'Nothing recorded — a rest day.',
  },
};

const text = (s: string): Segment => ({ t: 'text', s });

/** "a, b ve c" — virgül ve bağlaç metin parçası olarak. */
function joinList(items: Segment[], and: string): Segment[] {
  const out: Segment[] = [];
  items.forEach((it, i) => {
    if (i > 0) out.push(text(i === items.length - 1 ? and : ','));
    out.push(it);
  });
  return out;
}

export function buildDaySentence(metrics: DayMetric[], lang: Lang, past = false): Segment[] {
  const w = W[lang];
  const active = metrics.filter(m => m.total > 0);

  if (past) {
    const did = metrics.filter(m => m.done > 0);
    if (did.length === 0) return [text(w.pastEmpty)];
    const parts: Segment[] = [];
    did.forEach((m, i) => {
      if (i > 0) parts.push(text(i === did.length - 1 ? w.and : ','));
      parts.push({ t: 'token', kind: m.kind, s: w.did[m.kind](m.done), done: m.total > 0 && m.done >= m.total });
      parts.push(text(w.pastVerb[m.kind] + (i === did.length - 1 ? '.' : '')));
    });
    return parts;
  }

  if (active.length === 0) return [text(w.empty)];
  const finished = active.filter(m => m.done >= m.total);
  const pending = active.filter(m => m.done < m.total);
  const remTok = (m: DayMetric): Segment => ({ t: 'token', kind: m.kind, s: w.rem[m.kind](m.total - m.done), done: false });
  const doneTok = (m: DayMetric): Segment => ({ t: 'token', kind: m.kind, s: `✓ ${w.doneTok[m.kind]}`, done: true });

  if (pending.length === 0) return [text(w.closed), ...finished.map(doneTok)];
  if (finished.length === 0) return [text(w.today), ...joinList(pending.map(remTok), w.and), text(w.waiting)];
  return [...joinList(finished.map(doneTok), w.and), text(w.done), ...joinList(pending.map(remTok), w.and), text(w.left)];
}
