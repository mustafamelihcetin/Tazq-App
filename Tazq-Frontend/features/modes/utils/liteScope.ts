import { PLAN_TAGS } from '@/shared/utils/planKey';

/*
  SADE MODUN KAPSAMI (2026-11-06, kullanıcı: "sade mod todo list ve odak kısmı içermeli, sadece işlev odaklı"; "x'den gitme y'den git demek sadelik değil").
  Sade mod iki iştir: yapılacaklar listesi (Bugün + Görevler) ve Odak. TAZQ Core da yalnız bunları sunar: görev ara/ekle, odak başlat, tüm görevler.

  Kim ne ister:
  · Hedef: sayfası yok. Hedefi olmayan sözcüğü görmez. Hedefi olana geçişte sorulur (görevleri gelsin / dursun), Profil'den değiştirilir. Daha fazlası tam modda.
  · Alışkanlık: yok; seriler bu sürede işlemez, onayda söylenir.
  · Ödeme: bildirimi gelir, bugün son günü ya da gecikmişse ana sayfada tek kart görünür (kaçırmanın bedeli gerçek). İkisi de Ödemeler'i açar, başka girişi yok.
  · Bildirim: görev, odak ve ödeme kalır. Sabah, akşam, haftalık, geri dönüş ve sınav geri sayımı susar.
  · Açılış: üç sözcük ve titreşim yok, yalnız TAZQ. Profil: kimlik + tek çıkış. Değerlendirme istemi yok.
*/
const LITE_HIDDEN = new Set(['cockpit', 'modlar', 'mod-ozet', 'plan', 'achievements', 'report', 'gun', 'rota', 'takvim', 'aliskanlik']);

export const isHiddenInLite = (route: string | undefined): boolean => !!route && LITE_HIDDEN.has(route);

/** Hedefler duraklatıldıysa plan görevleri listede görünmez (silinmez). Yalnız görünüm içindir: depoya geri yazılmamalı. */
export const hiddenByGoalPause = (task: { tags?: string[] | null }, pause: { uiMode: string; liteGoalsPaused: boolean }): boolean =>
  pause.uiMode === 'lite' && pause.liteGoalsPaused && (task.tags ?? []).some(t => (PLAN_TAGS as readonly string[]).includes(t));
