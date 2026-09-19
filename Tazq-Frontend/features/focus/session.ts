import { AppState } from 'react-native';
import { useFocusStore, remainingFromClock } from './store/useFocusStore';
import { FocusService } from '@/shared/services/api';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { isNetworkError } from '@/shared/utils/errors';
import { swallow } from '@/shared/utils/swallow';
import { scheduleFocusAlert, cancelFocusAlert, FOCUS_END_ID, FOCUS_STRICT_ID } from '@/shared/utils/notifications';

/**
 * ODAK SEANSI — ekrandan BAĞIMSIZ kurallar (tek kaynak).
 *
 * Seans odak ekranı açık değilken de bitebiliyor: kullanıcı ana sayfadayken, telefon
 * kilitliyken, uygulama kapalıyken. Kayıt, bitiş alarmı ve katı mod kuralı bu yüzden
 * ekranın içinde değil burada; ekran yalnız GÖRSEL kutlamayı yapar.
 */

// ── Odak ekranı görünür mü? ──────────────────────────────────────────────────
// Görünürken bitişi ekran kutlar (ses + ritüel): bildirim ve tost susar.
let focusScreenVisible = false;
export const setFocusScreenVisible = (v: boolean) => { focusScreenVisible = v; };
export const isFocusScreenVisible = () => focusScreenVisible;

// ── Kayıt ────────────────────────────────────────────────────────────────────
export type CommitResult = 'saved' | 'too-short' | 'not-focus' | 'duplicate';

/**
 * Seansı kaydeder — uygulamada `FocusService.saveSession`in TEK çağrıldığı yer.
 *
 *  · 1 dakikanın altı kaydedilmez.
 *  · Mola odak değildir, kaydedilmez.
 *  · Aynı seans yalnız BİR kez kaydedilir (bkz. useFocusStore.claimCommit) — seans
 *    kaç yoldan biterse bitsin.
 *  · Çevrimdışıysa kuyruğa girer; ağ hatasında da.
 */
export function commitFocusSession(minutes: number, completed: boolean): CommitResult {
  const st = useFocusStore.getState();
  if (st.sessionKind === 'break') return 'not-focus';
  if (!Number.isFinite(minutes) || minutes < 1) return 'too-short';
  if (!st.claimCommit()) return 'duplicate';

  /*
    Bilinen eksiklik: sunucu seansın TARİHİNİ kabul etmiyor, aldığı anı damgalıyor.
    Eşitleme gece yarısını geçerse seans ertesi güne yazılır (bkz. OfflineOp notu).
  */
  const queueSession = () => {
    useOfflineQueue.getState().enqueue({
      type: 'focus-session',
      taskName: 'Focus',
      minutes,
      completed,
      occurredAt: new Date().toISOString(),
    });
  };
  if (!useNetworkStore.getState().isOnline) {
    queueSession();
  } else {
    FocusService.saveSession('Focus', minutes, completed).catch((e: unknown) => {
      // Ağ hatası → kuyruğa al. Gerçek sunucu hatası → kaydı düşür (yeniden denemek
      // aynı reddi üretir) ama izini bırak.
      if (isNetworkError(e)) queueSession();
      else swallow('focus.saveSession', e, { capture: true });
    });
  }
  st.addFocusMinutes(minutes);
  // Tamamlanan seans sabit ödül; erken bırakılan süreyle orantılı (üst sınır aynı).
  st.addFocusPoints(completed ? 10 : Math.min(10, minutes * 2));
  return 'saved';
}

/**
 * Süresi DOLMUŞ ama henüz kaydedilmemiş odak seansını kaydeder.
 *
 * Eskiden bu iş `_layout`ta ayrı bir hesapla yapılıyordu ve iki hatası vardı: ekranda
 * geçen süreyi İKİ KEZ düşüyordu (25 dakikalık seans 16. dakikada "bitti" sayılıyordu)
 * ve ekran da aynı seansı ayrıca kaydediyordu. Artık süre tek kaynaktan (bitiş anı)
 * okunuyor, kayıt da tek kilitten geçiyor.
 */
export function finalizeDueSession(): CommitResult | null {
  const st = useFocusStore.getState();
  if (st.isActive || st.seconds !== 0 || st.totalSeconds <= 0) return null;
  if (st.sessionKind !== 'focus') return null;
  /*
    Kimliği ve bitiş anı OLMAYAN sıfır sayaç bir seans değildir. Sürüm yükseltmesinde
    diskte kalmış eski bir "0" durumu, hiç yaşanmamış bir seansı kaydettirebilirdi.
  */
  if (st.sessionId == null && st.finishedAt == null) return null;
  if (st.committedSessionId != null && st.committedSessionId === st.sessionId) return null;
  const minutes = Math.round(st.totalSeconds / 60);
  const res = commitFocusSession(minutes, true);
  // Kullanıcı başka ekrandaysa haberi olsun; odak ekranı kendisi kutlar.
  if (res === 'saved' && AppState.currentState === 'active' && !focusScreenVisible) {
    try {
      const lang = toLang(require('@/shared/store/useLanguageStore').useLanguageStore.getState().language);
      require('@/shared/store/useToastStore').useToastStore.getState().show(COPY[lang].savedToast(minutes), 'success');
    } catch (e) { swallow('focus.finalizeToast', e); }
  }
  return res;
}

// ── Bitiş alarmı ─────────────────────────────────────────────────────────────
type Lang = 'tr' | 'en';
const toLang = (l: string | undefined): Lang => (l === 'en' ? 'en' : 'tr');

const COPY = {
  tr: {
    focusTitle: 'Odak seansı tamamlandı ✦',
    focusBody: (m: number, task: string) => `${m} dakika odaklandın${task ? ` · ${task}` : ''}. Kısa bir mola ver.`,
    roundTitle: 'Tur tamamlandı',
    roundBody: 'Mola zamanı. Uygulamaya dön, molan hazır.',
    breakTitle: 'Mola bitti',
    breakBody: 'Hazırsan sıradaki odak turuna başla.',
    strictTitle: 'Odaktan çıktın',
    strictBody: '10 saniye içinde dönmezsen seans biter.',
    savedToast: (m: number) => `Odak seansın tamamlandı · ${m} dk kaydedildi`,
    strictEnded: 'Katı mod: odaktan ayrıldığın için seans bitti.',
    strictEndedSaved: (m: number) => `Katı mod: odaktan ayrıldığın için seans bitti · ${m} dk kaydedildi.`,
  },
  en: {
    focusTitle: 'Focus session complete ✦',
    focusBody: (m: number, task: string) => `You focused for ${m} min${task ? ` · ${task}` : ''}. Take a short break.`,
    roundTitle: 'Round complete',
    roundBody: 'Break time. Come back, your break is ready.',
    breakTitle: 'Break is over',
    breakBody: 'Start the next focus round when you are ready.',
    strictTitle: 'You left focus',
    strictBody: 'Come back within 10 seconds or the session ends.',
    savedToast: (m: number) => `Focus session complete · ${m} min saved`,
    strictEnded: 'Strict mode: the session ended because you left.',
    strictEndedSaved: (m: number) => `Strict mode: the session ended because you left · ${m} min saved.`,
  },
};

export interface AlarmInput {
  isActive: boolean;
  expectedFinishAt: number | null;
  totalSeconds: number;
  sessionKind: 'focus' | 'break';
  pomodoroMode: boolean;
  currentTask: string;
}

/** Hangi bildirim, ne zaman? Saf fonksiyon — test edilebilir. Çalışmayan seansta alarm yok. */
export function focusAlarmSpec(st: AlarmInput, lang: Lang, hideContent: boolean) {
  if (!st.isActive || !st.expectedFinishAt) return null;
  const c = COPY[lang];
  const minutes = Math.round(st.totalSeconds / 60);
  if (st.sessionKind === 'break') return { fireAt: st.expectedFinishAt, title: c.breakTitle, body: c.breakBody };
  if (st.pomodoroMode) return { fireAt: st.expectedFinishAt, title: c.roundTitle, body: c.roundBody };
  const task = hideContent ? '' : st.currentTask.trim();
  return { fireAt: st.expectedFinishAt, title: c.focusTitle, body: c.focusBody(minutes, task) };
}

let lastAlarmKey: string | null = null;

/**
 * Alarmı seansın durumuna eşitler. Store'daki HER değişiklikte çağrılabilir: yalnız
 * bitiş anı / tür değiştiğinde bildirim sistemine dokunur (saniyelik tik ucuz geçer).
 * Duraklat, sıfırla, erken bitir, süre değiştir — hepsi alarmı kendiliğinden iptal eder.
 */
export function syncFocusAlarm(): void {
  const st = useFocusStore.getState();
  let lang: Lang = 'tr';
  let hide = false;
  try {
    lang = toLang(require('@/shared/store/useLanguageStore').useLanguageStore.getState().language);
    hide = !!require('@/features/modes/store/usePrefsStore').usePrefsStore.getState().hideNotificationContent;
  } catch (e) { swallow('focus.alarmPrefs', e); }
  const spec = focusAlarmSpec(st, lang, hide);
  const key = spec ? `${spec.fireAt}|${spec.title}|${spec.body}` : null;
  if (key === lastAlarmKey) return;
  lastAlarmKey = key;
  if (!spec) { void cancelFocusAlert(FOCUS_END_ID); return; }
  // Geçmişe kurulan bildirim ya hemen çalar ya da hiç — ikisi de yanlış.
  if (spec.fireAt <= Date.now() + 1000) { void cancelFocusAlert(FOCUS_END_ID); return; }
  void scheduleFocusAlert(FOCUS_END_ID, new Date(spec.fireAt), spec.title, spec.body);
}

/** Yalnız testler için: modül hafızasını sıfırlar. */
export function __resetFocusAlarmForTests() { lastAlarmKey = null; focusScreenVisible = false; leftAt = null; remainingAtLeave = 0; }

// ── Katı mod ─────────────────────────────────────────────────────────────────
/**
 * KATI MOD: uygulamadan bu süreden uzun ayrılan seansı bitirir.
 *
 * Eskiden 2 saniyeydi ve ekranın kendiliğinden kararması da "ayrılmak" sayılıyordu:
 * kullanıcı hiçbir şey yapmadan seansı iptal oluyor, üstüne 10 puan kesiliyordu.
 * Artık seans sırasında ekran açık tutuluyor (odak ekranı), ayrılan kullanıcıya
 * dönmesi için süre ve bir uyarı veriliyor; puan cezası YOK — seansın bitmesi yeterli
 * sonuç, ceza kullanıcıyı uygulamadan soğutur.
 */
export const STRICT_GRACE_MS = 10_000;

export function strictLeaveWarning(lang: Lang): void {
  const c = COPY[lang];
  void scheduleFocusAlert(FOCUS_STRICT_ID, new Date(Date.now() + 1500), c.strictTitle, c.strictBody);
}

export function clearStrictLeaveWarning(): void {
  // Kullanıcı döndü: kilit ekranındaki "Odaktan çıktın" uyarısı da kalkar.
  void cancelFocusAlert(FOCUS_STRICT_ID, true);
}

let leftAt: number | null = null;
let remainingAtLeave = 0;

/** Uygulama arka plana geçti: katı modda çalışan odak seansı için ayrılış anı tutulur. */
export function onAppBackground(now: number = Date.now()): void {
  const st = useFocusStore.getState();
  if (!(st.strictMode && st.isActive && st.sessionKind === 'focus' && st.expectedFinishAt)) {
    leftAt = null;
    return;
  }
  leftAt = now;
  remainingAtLeave = remainingFromClock(st.expectedFinishAt, now);
  let lang: Lang = 'tr';
  try { lang = toLang(require('@/shared/store/useLanguageStore').useLanguageStore.getState().language); } catch (e) { swallow('focus.strictLang', e); }
  strictLeaveWarning(lang);
}

/**
 * Uygulamaya dönüldü. Katı modda süre aşıldıysa seans BİTER: ayrılana kadarki dakikalar
 * (ayrı geçen süre DEĞİL) tamamlanmamış seans olarak kaydedilir. Seans bittiyse true.
 */
export function onAppForeground(now: number = Date.now()): boolean {
  const was = leftAt;
  leftAt = null;
  if (was == null) return false;
  clearStrictLeaveWarning();
  if (!strictBreached(was, now)) return false;
  const st = useFocusStore.getState();
  if (st.sessionKind !== 'focus' || !st.sessionId) return false; // bu arada başka yoldan bitmiş
  const minutes = Math.floor(Math.max(0, st.totalSeconds - remainingAtLeave) / 60);
  const res = commitFocusSession(minutes, false);
  st.reset();
  try {
    const lang = toLang(require('@/shared/store/useLanguageStore').useLanguageStore.getState().language);
    const msg = res === 'saved' ? COPY[lang].strictEndedSaved(minutes) : COPY[lang].strictEnded;
    require('@/shared/store/useToastStore').useToastStore.getState().show(msg, 'info');
  } catch (e) { swallow('focus.strictToast', e); }
  return true;
}

/**
 * Ayrılış bir seansı bitirmeli mi? Saf karar.
 * `leftAt`: arka plana geçiş anı. Kısa ayrılık (bildirim çekme, kontrol merkezi,
 * hızlı bir mesaj) seansı bozmaz.
 */
export function strictBreached(leftAt: number | null, now: number): boolean {
  return leftAt != null && now - leftAt > STRICT_GRACE_MS;
}
