import { Platform } from 'react-native';
import { useFocusStore } from '@/features/focus/store/useFocusStore';
import { swallow } from '@/shared/utils/swallow';

/*
  DİNAMİK ADA / KİLİT EKRANI — CANLI ETKİNLİK (2026-11-01, kullanıcı: "uygulamadan çıkıldı diyelim seans varken;
  bazı uygulamalar dinamik adaya geliyor — iPhone için yapabilir miyiz?").

  Kaynak: expo-live-activity (Software Mansion). Sayaç SİSTEMİN: bitiş anını (`expectedFinishAt`) veririz,
  iOS kendisi geri sayar — uygulama arka planda çalışmasa da doğru akar (bizim saatimiz de bitiş anına bağlı).
   · başladı / devam etti → bitiş anına geri sayım (odakta vurgu, molada üçüncül renk)
   · duraklatıldı          → "Duraklatıldı" + kalan süre sabit (ilerleme çubuğu durur)
   · bitti / sıfırlandı    → kapanır
  Dokununca uygulama odak ekranında açılır (tazq-app://focus).

  YALNIZ iOS 16.2+ ve modülü içeren derlemede: dev istemcide/Expo Go'da/Android'de modül yoktur → sessizce no-op.
  Ada yalnız iPhone 14 Pro ve sonrasında; diğer iPhone'larda kilit ekranında görünür.
*/

type LA = typeof import('expo-live-activity');
let mod: LA | null | undefined;
function la(): LA | null {
  if (mod !== undefined) return mod;
  mod = null;
  if (Platform.OS !== 'ios') return mod;
  try {
    // JS paketi her derlemede var; YEREL modül yalnız onu içeren derlemede. Yoksa kütüphane null modülle
    // yüklenir ve her çağrı patlar — o yüzden önce yerel modülün varlığına bakılır.
    const { requireOptionalNativeModule } = require('expo') as typeof import('expo');
    if (requireOptionalNativeModule('ExpoLiveActivity')) mod = require('expo-live-activity') as LA;
  } catch (e) { swallow('liveActivity.require', e); }
  return mod;
}

// Yerel (SwiftUI) görünüm onaltılık renk ister; tema nesnesi oraya ulaşmaz. Ada/kilit ekranı hep koyu.
const COLORS = { bg: '#0B0F1C', title: '#FFFFFF', sub: '#A7B0C8', focus: '#6E95FF', rest: '#3CCFB4' };

const COPY = {
  tr: { break: 'Mola', focus: 'Odak', onBreak: 'Mola sürüyor', focusing: 'Odak sürüyor', paused: (m: number) => `Duraklatıldı · ${m} dk kaldı`, ended: 'Seans bitti', sample: 'Örnek odak' },
  en: { break: 'Break', focus: 'Focus', onBreak: 'On a break', focusing: 'Focusing', paused: (m: number) => `Paused · ${m} min left`, ended: 'Session ended', sample: 'Sample focus' },
};

type Snapshot = { key: string; title: string; subtitle: string; date?: number; progress?: number; tint: string } | null;

function snapshot(lang: 'tr' | 'en'): Snapshot {
  const s = useFocusStore.getState();
  const started = s.isActive || s.totalSeconds - s.seconds > 0;
  if (!started || s.seconds <= 0) return null;
  const isBreak = s.sessionKind === 'break' || (s.pomodoroMode && s.pomodoroPhase === 'break');
  const c = COPY[lang];
  const title = s.currentTask || (isBreak ? c.break : c.focus);
  const tint = isBreak ? COLORS.rest : COLORS.focus;
  if (s.isActive && s.expectedFinishAt) {
    const subtitle = isBreak ? c.onBreak : c.focusing;
    return { key: `run:${s.expectedFinishAt}:${title}:${isBreak}`, title, subtitle, date: s.expectedFinishAt, tint };
  }
  const m = Math.ceil(s.seconds / 60);
  const subtitle = c.paused(m);
  return { key: `pause:${s.seconds}:${title}`, title, subtitle, progress: s.totalSeconds > 0 ? 1 - s.seconds / s.totalSeconds : 0, tint };
}

let activityId: string | null = null;
let lastKey: string | null = null;

/** Odak deposunu Canlı Etkinliğe yansıtır; durum değişmediyse hiçbir şey yapmaz. */
export function syncLiveActivity(lang: 'tr' | 'en') {
  const L = la();
  if (!L) return;
  const snap = snapshot(lang);
  try {
    if (!snap) {
      if (activityId) L.stopActivity(activityId, { title: COPY[lang].ended });
      activityId = null; lastKey = null;
      return;
    }
    if (snap.key === lastKey) return;
    lastKey = snap.key;
    const state = {
      title: snap.title,
      subtitle: snap.subtitle,
      progressBar: snap.date ? { date: snap.date } : { progress: snap.progress ?? 0 },
    };
    if (activityId) {
      L.updateActivity(activityId, state);
    } else {
      const id = L.startActivity(state, {
        backgroundColor: COLORS.bg, titleColor: COLORS.title, subtitleColor: COLORS.sub,
        progressViewTint: snap.tint, progressViewLabelColor: COLORS.title,
        // Bağlantı = ilk URL şeması + "://" + bu yol (kütüphane kuralı) → tazq-app://focus.
        deepLinkUrl: 'focus', timerType: 'circular',
      });
      activityId = id || null;
    }
  } catch (e) {
    swallow('liveActivity.sync', e);
  }
}

/** Uygulama boyunca odak deposunu dinler (bkz. app/_layout.tsx). */
export function startLiveActivitySync(getLang: () => 'tr' | 'en'): () => void {
  if (!la()) return () => {};
  syncLiveActivity(getLang());
  return useFocusStore.subscribe((s, p) => {
    // Saniyelik `seconds` değişimi tek başına tetiklemez (duraklıyken de seconds sabit); yalnız anlamlı alanlar.
    if (s.isActive !== p.isActive || s.expectedFinishAt !== p.expectedFinishAt || s.currentTask !== p.currentTask
      || s.sessionKind !== p.sessionKind || s.pomodoroPhase !== p.pomodoroPhase || (s.seconds <= 0) !== (p.seconds <= 0)
      || (!s.isActive && s.seconds !== p.seconds)) {
      syncLiveActivity(getLang());
    }
  });
}

/** ADMIN ÖNİZLEMESİ — 2 dakikalık örnek Canlı Etkinlik (Dinamik Ada / kilit ekranı). false = bu derlemede yok. */
export function startDemoLiveActivity(lang: 'tr' | 'en'): boolean {
  const L = la();
  if (!L) return false;
  try {
    const id = L.startActivity(
      { title: COPY[lang].sample, subtitle: COPY[lang].focusing, progressBar: { date: Date.now() + 2 * 60 * 1000 } },
      { backgroundColor: COLORS.bg, titleColor: COLORS.title, subtitleColor: COLORS.sub, progressViewTint: COLORS.focus, progressViewLabelColor: COLORS.title, deepLinkUrl: 'focus', timerType: 'circular' },
    );
    if (id) setTimeout(() => { try { L.stopActivity(id, { title: COPY[lang].ended }); } catch (e) { swallow('liveActivity.demoStop', e); } }, 2 * 60 * 1000 + 3000);
    return !!id;
  } catch (e) { swallow('liveActivity.demo', e); return false; }
}
