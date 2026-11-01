/**
 * ODAK EKRANI BAŞLIĞI — duruma göre (2026-11-01, kullanıcı: "tüm durumlar için DERİN ODAK doğru terim mi?").
 *
 * "Derin odak" bir iddiaydı ve her durumda aynıydı: molada da, 5 dakikalık seansta da "DERİN ODAK"
 * yazıyordu. Başlık artık ekranın o an ne olduğunu söyler; sekmenin adıyla (Odak) aynı dili kullanır.
 *  · mola (standart ya da pomodoro) → MOLA
 *  · pomodoro çalışma turu → POMODORO (tur sayısı zaten alttaki göstergede)
 *  · geri kalan her şey → ODAK
 */
const LABELS = {
  tr: { focus: 'ODAK', pomodoro: 'POMODORO', break: 'MOLA' },
  en: { focus: 'FOCUS', pomodoro: 'POMODORO', break: 'BREAK' },
};

export function focusTitle(p: { inBreak: boolean; pomodoroMode: boolean; language: string }): string {
  const l = LABELS[p.language === 'en' ? 'en' : 'tr'];
  if (p.inBreak) return l.break;
  return p.pomodoroMode ? l.pomodoro : l.focus;
}
