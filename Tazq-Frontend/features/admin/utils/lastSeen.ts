/*
  SON GÖRÜLME (2026-11-06, kullanıcı: "hiç giriş yok diyor; en son ne zaman girdiyse o yazsın, WhatsApp gibi"). Son görülme alanı sonradan eklendi: o günden beri gelmeyen 15 kişide boştu, "Hiç giriş yok" yazıyordu. Sunucu artık son oturum açışını gönderir.
  Biçim: az önce · bugün 14:32 · dün 09:10 · 3 Kas 18:20 · başka yılda yıl da yazar. Gün karşılaştırması takvim gününe göre: 23 saat önce "dün" olabilir.
*/
const COPY = {
  tr: { locale: 'tr-TR', never: 'Henüz görülmedi', now: 'Az önce görüldü', today: (t: string) => `Bugün ${t}`, yesterday: (t: string) => `Dün ${t}` },
  en: { locale: 'en-US', never: 'Not seen yet', now: 'Seen just now', today: (t: string) => `Today ${t}`, yesterday: (t: string) => `Yesterday ${t}` },
};

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function lastSeenLabel(iso: string | null | undefined, lang: 'tr' | 'en', now: Date = new Date()): string {
  const c = COPY[lang];
  if (!iso) return c.never;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return c.never;
  if (now.getTime() - at.getTime() < 60_000) return c.now;
  const time = at.toLocaleTimeString(c.locale, { hour: '2-digit', minute: '2-digit' });
  const days = Math.round((dayStart(now) - dayStart(at)) / 86_400_000);
  if (days === 0) return c.today(time);
  if (days === 1) return c.yesterday(time);
  const date = at.toLocaleDateString(c.locale, at.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  return `${date} ${time}`;
}
