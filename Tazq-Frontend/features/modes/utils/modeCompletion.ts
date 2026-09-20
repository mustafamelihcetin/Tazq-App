import { parseDateKey } from '@/shared/utils/dateKey';

/**
 * HEDEF TARİHİ GEÇTİ Mİ? — saf kural.
 *
 * Kanca (useModeCompletionReview) React ve expo-router'a bağlı; kuralın kendisi değil.
 * Ayrı durması hem test edilebilir kılıyor hem de "gün sonuna kadar geçmiş sayılmaz"
 * kararının tek bir yerde kalmasını sağlıyor.
 *
 * Gün SONU ölçüt: sınav/teslim günü 23:59'a kadar "bugün"dür. Saat ölçütü olsaydı
 * sabah 09:00'da sınava giren kullanıcıya öğlen "nasıl geçti?" diye sorulurdu.
 */
export function datePassed(dateStr: string | null | undefined, now: number = Date.now()): boolean {
  if (!dateStr) return false;
  return parseDateKey(dateStr).setHours(23, 59, 59, 999) < now;
}

/**
 * RİTÜEL METİNLERİ — iki dil yan yana, mod başına.
 *
 * Kartların içinde satır içi `tr ? '...' : '...'` olarak yazılsaydı, aynı akışın üç
 * kopyası üç ayrı dosyada birbirinden bağımsız yaşardı (bkz. i18nRatchet). Tek tablo,
 * tek kural: cevaplar hep üç tane ve hepsi modu kapatır.
 */
export type CompletionMode = 'tez' | 'mulakat' | 'spor';

export interface CompletionCopy {
  title: string;
  question: string;
  answers: string[];
  cancel: string;
  toast: string;
  undo: string;
}

const COMPLETION = {
  tr: {
    question: 'Nasıl geçti?',
    cancel: 'Şimdi değil',
    undo: 'Geri al',
    tez: {
      title: (n: string) => `${n || 'Tez'} teslim günü geçti`,
      answers: ['Teslim ettim', 'Ertelendi', 'Yarım kaldı'],
      toast: 'Tez modu kapatıldı',
    },
    mulakat: {
      title: (n: string) => `${n || 'Mülakat'} günü geçti`,
      answers: ['İyi geçti', 'Orta geçti', 'Zor geçti'],
      toast: 'Mülakat modu kapatıldı',
    },
    spor: {
      title: () => 'Hedef tarihin geçti',
      answers: ['Hedefe ulaştım', 'Yaklaştım', 'Olmadı'],
      toast: 'Spor modu kapatıldı',
    },
  },
  en: {
    question: 'How did it go?',
    cancel: 'Not now',
    undo: 'Undo',
    tez: {
      title: (n: string) => `${n || 'Thesis'} deadline has passed`,
      answers: ['Submitted it', 'Postponed', 'Left unfinished'],
      toast: 'Thesis mode closed',
    },
    mulakat: {
      title: (n: string) => `${n || 'Interview'} day has passed`,
      answers: ['Went well', 'So-so', 'It was tough'],
      toast: 'Interview mode closed',
    },
    spor: {
      title: () => 'Your target date has passed',
      answers: ['Reached it', 'Got close', 'Not this time'],
      toast: 'Fitness mode closed',
    },
  },
};

export function completionCopy(mode: CompletionMode, isTr: boolean, name = ''): CompletionCopy {
  // Dizeye çeviren bir ternary yazılmıyor: çeviri borcu sayacı satır içi
  // `tr ? '...' : '...'` kalıbını borç sayar ve bu dosya yeni (bkz. i18nRatchet).
  const c = isTr ? COMPLETION.tr : COMPLETION.en;
  const m = c[mode];
  return { title: m.title(name), question: c.question, answers: m.answers, cancel: c.cancel, toast: m.toast, undo: c.undo };
}
