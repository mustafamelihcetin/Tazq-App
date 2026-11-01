/** Gelen kutusu kalem metinleri (bkz. inboxItems.ts) — iki dil ayrı yazıldı. */
export const INBOX_COPY = {
  tr: {
    paymentOverdue: (d: number) => `${d} gün gecikti`,
    paymentToday: 'Bugün ödenecek',
    paymentIn: (d: number) => (d === 1 ? 'Yarın ödenecek' : `${d} gün sonra ödenecek`),
    supportReply: 'Destekten yanıt geldi',
    supportSub: (p: string) => (p ? `“${p}${p.length >= 60 ? '…' : ''}”` : 'Konuşmayı aç'),
    badge: 'Yeni başarım',
    tomorrow: (n: number) => `Yarın ${n} işin var`,
    tomorrowSub: 'Göz at, gerekirse şimdiden düzenle.',
  },
  en: {
    paymentOverdue: (d: number) => `${d} day${d === 1 ? '' : 's'} overdue`,
    paymentToday: 'Due today',
    paymentIn: (d: number) => (d === 1 ? 'Due tomorrow' : `Due in ${d} days`),
    supportReply: 'Support replied',
    supportSub: (p: string) => (p ? `“${p}${p.length >= 60 ? '…' : ''}”` : 'Open the conversation'),
    badge: 'New achievement',
    tomorrow: (n: number) => `${n} task${n === 1 ? '' : 's'} tomorrow`,
    tomorrowSub: 'Take a look and adjust ahead if needed.',
  },
};
