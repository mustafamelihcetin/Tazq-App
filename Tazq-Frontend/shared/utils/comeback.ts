/**
 * MOMENTUM KORUMA (madde 11) — 2 gün açılmayınca baskısız geri çağrı.
 *
 * Tasarım: her açılışta 48 saat sonrasına TEK bir bildirim kurulur, öncekinin yerine
 * geçer. Düzenli açan kullanıcı onu hiç görmez; uzaklaşan, tam ikinci günün sonunda
 * bir kez görür. Sunucu, zamanlayıcı ya da "son görülme" takibi gerekmez.
 *
 * Metin suçlamaz, seri/sayı hatırlatmaz (kopuşta en çok vazgeçiren şey "seri bozuldu"
 * duygusu); yalnız 1 dakikalık bir mikro adım önerir. Gece rahatsız etmez.
 */
const QUIET_START = 22;
const QUIET_END = 9;
const MORNING = 10;

export function comebackTime(now: Date = new Date()): Date {
  const t = new Date(now.getTime() + 48 * 3600 * 1000);
  const h = t.getHours();
  if (h >= QUIET_START) { t.setDate(t.getDate() + 1); t.setHours(MORNING, 0, 0, 0); }
  else if (h < QUIET_END) t.setHours(MORNING, 0, 0, 0);
  return t;
}

export const COMEBACK_COPY = {
  tr: { title: 'Bir dakikan var mı?', body: 'Kaldığın yerden devam etmek için tek küçük adım yeter. Hiçbir şey kaybolmadı.' },
  en: { title: 'Got a minute?', body: 'One small step is enough to pick up where you left off. Nothing is lost.' },
};
