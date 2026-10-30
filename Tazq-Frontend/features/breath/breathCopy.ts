import type { BreathId, PhaseKind } from '@/features/breath/patterns';
import type { BreathSound } from '@/features/breath/breathCues';

/*
  Nefes seansı metinleri. Bilimsel satırlar ABARTMAZ: her biri tek cümle ve kaynağını
  söyler; kullanıcı "neden bu?" diye merak ederse karşısında bir iddia değil bir çalışma
  olsun (alışkanlık sınırındaki ilkeyle aynı).
*/
type Item = { title: string; technique: string; why: string; source: string; /** Önerilen süre + gerekçesi (bkz. patterns.options). */ dose: string };

export const BREATH_COPY = {
  tr: {
    title: 'Nefes',
    sub: 'Bir amaç seç. Ekrana bakman gerekmez: titreşim ve ses yol gösterir.',
    minutes: (m: number) => `${m} dk`,
    breaths: (n: number) => `${n} nefes`,
    recommended: 'Önerilen',
    duration: 'Süre',
    sound: 'Ses rehberi',
    soundLabel: 'Ses',
    themes: { wave: 'Nefes', kalimba: 'Kalimba', warm: 'Sıcak' } as Record<BreathSound, string>,
    soundOn: 'Açık', soundOff: 'Kapalı',
    start: (dose: string) => `Başla · ${dose}`,
    ready: 'Hazırlan',
    pause: 'Duraklat', resume: 'Devam', stop: 'Bitir',
    paused: 'Duraklatıldı',
    left: (s: string) => `${s} kaldı`,
    dur: (s: number) => (s < 60 ? `${Math.round(s)} sn` : `${Math.round(s / 60)} dk`),
    doneTitle: 'Güzel.',
    doneBody: (min: string, n: number) => `${min} · ${n} nefes. Bedenin bunu fark etti.`,
    toFocus: 'Odağa geç', close: 'Kapat', again: 'Bir tur daha',
    why: 'Neden işe yarar?',
    phase: { in: 'Nefes al', top: 'Bir yudum daha', hold: 'Tut', out: 'Yavaşça ver', rest: 'Bekle' } as Record<PhaseKind, string>,
    items: {
      sigh: { title: 'Sakinleş', technique: 'Döngüsel iç çekiş · 2+1 al, 6 ver', why: 'Uzun veriş kalbi yavaşlatır. Günde 5 dakika, ruh hâlini farkındalık meditasyonundan daha çok iyileştirdi.', source: 'Balban ve ark., Cell Reports Medicine, 2023', dose: 'Önerilen 5 dk — çalışmada günde 5 dakika uygulandı. Anlık rahatlama için 1 dakika da işe yarar.' },
      box: { title: 'Odaklan', technique: 'Kutu nefesi · 4 al, 4 tut, 4 ver, 4 bekle', why: 'Eşit dört fazı saymak dağılan dikkati tek ritme toplar; baskı altında çalışan ekiplerin düzeni.', source: 'Yavaş nefes ve dikkat: Zaccaro ve ark., 2018', dose: 'Önerilen 5 dk — aynı çalışmada kutu nefesi de günde 5 dakika uygulandı.' },
      sleep: { title: 'Uyu', technique: '4-7-8 · 4 al, 7 tut, 8 ver', why: 'Uzun tutuş ve daha uzun veriş vücudu dinlenme moduna geçirir. Başlangıçta birkaç tur yeter.', source: 'Vierra ve ark., 2022', dose: 'Önerilen 4 nefes (~76 sn) — tekniğin önerisi: ilk ay 4 nefesi geçme, alıştıkça en çok 8.' },
      resonance: { title: 'Denge', technique: 'Rezonans · 5.5 sn al, 5.5 sn ver', why: 'Dakikada ~5.5 nefes, kalp ritmi değişkenliğinin en yüksek olduğu hızdır; stres tepkisini dengeler.', source: 'Lehrer ve Gevirtz, 2014', dose: 'Önerilen 10 dk — etki 10–20 dakikalık seanslarda ölçüldü; 5 dakika kısa bir başlangıç.' },
    } as Record<BreathId, Item>,
    focusRow: 'Sakinleş, odaklan, uyu — ayrı seans',
    afterFocus: '1 dk nefes',
  },
  en: {
    title: 'Breathe',
    sub: "Pick a goal. You don't need to watch: haptics and sound guide you.",
    minutes: (m: number) => `${m} min`,
    breaths: (n: number) => `${n} breaths`,
    recommended: 'Recommended',
    duration: 'Duration',
    sound: 'Sound guide',
    soundLabel: 'Sound',
    themes: { wave: 'Breath', kalimba: 'Kalimba', warm: 'Warm' } as Record<BreathSound, string>,
    soundOn: 'On', soundOff: 'Off',
    start: (dose: string) => `Start · ${dose}`,
    ready: 'Get ready',
    pause: 'Pause', resume: 'Resume', stop: 'End',
    paused: 'Paused',
    left: (s: string) => `${s} left`,
    dur: (s: number) => (s < 60 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`),
    doneTitle: 'Nice.',
    doneBody: (min: string, n: number) => `${min} · ${n} breaths. Your body noticed.`,
    toFocus: 'Start focus', close: 'Close', again: 'One more round',
    why: 'Why it works',
    phase: { in: 'Breathe in', top: 'One more sip', hold: 'Hold', out: 'Slowly out', rest: 'Rest' } as Record<PhaseKind, string>,
    items: {
      sigh: { title: 'Calm down', technique: 'Cyclic sighing · 2+1 in, 6 out', why: 'A long exhale slows the heart. Five minutes a day improved mood more than mindfulness meditation.', source: 'Balban et al., Cell Reports Medicine, 2023', dose: 'Recommended 5 min — the study used five minutes a day. Even one minute helps in the moment.' },
      box: { title: 'Focus', technique: 'Box breathing · 4 in, 4 hold, 4 out, 4 rest', why: 'Counting four equal phases gathers scattered attention into one rhythm; used by teams under pressure.', source: 'Slow breathing & attention: Zaccaro et al., 2018', dose: 'Recommended 5 min — box breathing was also practiced five minutes a day in the same study.' },
      sleep: { title: 'Sleep', technique: '4-7-8 · 4 in, 7 hold, 8 out', why: 'A long hold and longer exhale shift the body into rest mode. A few rounds are enough at first.', source: 'Vierra et al., 2022', dose: 'Recommended 4 breaths (~76 s) — the technique advises no more than 4 at first, up to 8 later.' },
      resonance: { title: 'Balance', technique: 'Resonance · 5.5 s in, 5.5 s out', why: 'About 5.5 breaths a minute is where heart rate variability peaks; it steadies the stress response.', source: 'Lehrer & Gevirtz, 2014', dose: 'Recommended 10 min — effects were measured in 10–20 minute sessions; 5 minutes is a short start.' },
    } as Record<BreathId, Item>,
    focusRow: 'Calm, focus, sleep — its own session',
    afterFocus: '1 min breathe',
  },
};
