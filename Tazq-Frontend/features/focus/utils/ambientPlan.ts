/**
 * ORTAM SESİ KARARI — saf (2026-11-01, kullanıcı: "seslerin odak varken ve yokken düzgün çalmasını,
 * durmasını, bugda kalmamasını sağla").
 *
 * Ölçülen hatalar (eski etkide):
 *  · Duraklatınca ses çalmaya DEVAM ediyordu: seans yokken yalnız "Sessiz" seçilince duruyordu.
 *  · Seans sürerken başka sekmeye gidip dönünce ses yoktu: durduran vardı, geri getiren yoktu.
 *
 * Kurallar:
 *  · Seans sürüyor + ses seçili → çal.
 *  · Seans sürüyor + "Sessiz" → durdur.
 *  · Seans az önce durdu (duraklatma, bitiş, sıfırlama) → yumuşakça sustur. Tercih KALIR.
 *  · Seans yok → dokunma: önizlemeyi (7 sn, sese dokununca) düğme kendisi yönetir; "Sessiz" ise durdur.
 */
export type AmbientAction = 'play' | 'stop' | 'fadeOut' | 'none';

export function ambientAction(p: { wasActive: boolean; isActive: boolean; sound: string }): AmbientAction {
  if (p.isActive) return p.sound === 'off' ? 'stop' : 'play';
  if (p.wasActive) return 'fadeOut';
  return p.sound === 'off' ? 'stop' : 'none';
}

/** Ekrana dönüşte: seans sürüyor, ses seçili ve çalan yoksa geri getir. */
export function shouldResumeOnFocus(p: { isActive: boolean; sound: string; playing: boolean }): boolean {
  return p.isActive && p.sound !== 'off' && !p.playing;
}
