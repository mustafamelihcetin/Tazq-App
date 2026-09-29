import { useHabitStore } from '@/features/habits/store/useHabitStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { usePrefsStore } from '@/features/modes/store/usePrefsStore';
import { useQuitStore, type QuitType } from '@/shared/store/useQuitStore';
import { TaskService, type CreateTaskPayload } from '@/shared/services/api';
import { buildBirakmaPlan, birakmaTypeLabel } from '@/shared/utils/lifeModePlans';
import { swallow } from '@/shared/utils/swallow';
import { isNetworkError } from '@/shared/utils/errors';

/**
 * ONBOARDING'İN ANINDA-BAŞLAT YARDIMCILARI.
 *
 * ── NEDEN AYRI DOSYA, NEDEN TurkishModeBanner DEĞİL ────────────────────────────
 * Modların "uygula" mantığının çoğu (~160 satır) `app/modlar.tsx`in kendi içinde,
 * slot seçimine ve o ekranın yerel form durumuna göre dallanıyor. Onboarding'den o
 * ekranı ya da banner'ı açmak, ikinci bir yerde aynı dallanmayı kopyalamak ya da
 * modlar.tsx'i riske atmak demekti — ikisi de istenmiyor.
 *
 * Burada yalnız GERÇEKTEN sıfır-girdili iki durum var (bkz. onboarding.tsx'teki
 * "şu an neyle uğraşıyorsun?" sorusu): Bırakma (tek tür seçimi yeter, tarih yok) ve
 * "sadece organize olmak istiyorum" (hiçbir moda bağlanmaz). İkisi de kartların
 * KENDİ store çağrılarını (setPlanIds/setSeasonalPref/createTask) birebir izler —
 * BirakmaCard.tsx'e dokunulmadı, yalnız tek-tür alt kümesi burada tekrarlandı.
 *
 * Sınav/Mülakat/Tez/Spor için burada bir karşılığı YOK: hepsi en az isim+tarih (ya
 * da spor'un sayısal alanları) istiyor, sıfır girdiyle kurulamıyor. Onlar için
 * onboarding yalnız `seasonal.<mod>Mode`i açar; kullanıcı ana ekranda `ModeTodayCard`
 * üzerinden (zaten var olan, mod açık ama plansızken de göründüğü için) `/modlar`a
 * yönlenip 2 alanı doldurur.
 */

/*
  ÇEVRİMDIŞI KUYRUĞA DÜŞME KOŞULU: yalnız `!isOnline` DEĞİL, `isNetworkError(e)` de.
  Misafir modunda her istek sunucuya hiç çıkmadan "ağ hatası" biçiminde reddediliyor
  (bkz. shared/services/api.ts → guestModeError; `isNetworkError` bunu `response`
  alanı olmadığı için doğru tanır). Bu kontrol atlanırsa — BirakmaCard/TasarrufCard'taki
  yerel yardımcıların yaptığı gibi — çevrimiçi ama misafir bir kullanıcıda görev ne
  sunucuya yazılır ne yerel listeye eklenir: sessizce kaybolur.
*/
async function createSeedTask(payload: CreateTaskPayload): Promise<number | null> {
  const queueOffline = () => {
    const tempId = -Date.now() - Math.floor(Math.random() * 1000);
    useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload });
    useTaskStore.getState().addTask({ ...payload, id: tempId } as any);
    return tempId;
  };
  if (!useNetworkStore.getState().isOnline) return queueOffline();
  try {
    const created = await TaskService.createTask(payload);
    if (created?.id) { useTaskStore.getState().addTask(created); return created.id; }
  } catch (e) {
    if (isNetworkError(e)) return queueOffline();
    swallow('onboarding.quickStart.createTask', e, { capture: true });
  }
  return null;
}

/** Bırakma planını TEK tür için anında kurar (bkz. dosya başındaki not). */
export async function quickStartBirakma(type: Exclude<QuitType, ''>, tr: boolean): Promise<void> {
  const content = buildBirakmaPlan(type);
  const habitIds: string[] = [];
  content.habits.forEach((h, i) => {
    const id = `habit_birakma_${i}_${Date.now()}`;
    useHabitStore.getState().addHabit(h.name, h.emoji, h.color, id, 'birakma');
    habitIds.push(id);
  });

  const taskIds: number[] = [];
  for (const t of content.tasks) {
    const id = await createSeedTask({
      title: tr ? t.title : t.titleEn,
      description: JSON.stringify({ tr: t.title, en: t.titleEn, descTr: t.desc, descEn: t.descEn }),
      priority: t.priority,
      isCompleted: false,
      tags: t.tags,
    });
    if (id != null) taskIds.push(id);
  }

  const prefs = usePrefsStore.getState();
  const label = birakmaTypeLabel(type, tr);
  prefs.setPlanIds('birakma', habitIds, taskIds);
  prefs.setSeasonalPref('birakmaMode', true);
  prefs.setSeasonalPref('birakmaName', label);
  useQuitStore.getState().addItem(type, label);
}

/**
 * "Sadece organize olmak istiyorum" — hiçbir moda/plan yuvasına dokunmadan TEK,
 * kolay tamamlanan bir karşılama görevi ekler. İşaretlendiğinde uygulamanın zaten
 * var olan "ilk başarı" kutlaması (bkz. features/user/utils/celebrate.ts) kendiliğinden
 * devreye girer — burada özel bir kutlama kurulmasına gerek yok.
 */
export async function quickStartWelcomeTask(tr: boolean): Promise<void> {
  const titleTr = "TAZQ'ya hoş geldin — bunu işaretleyerek başla";
  const titleEn = 'Welcome to TAZQ — check this off to get started';
  await createSeedTask({
    title: tr ? titleTr : titleEn,
    description: JSON.stringify({ tr: titleTr, en: titleEn }),
    priority: 'Medium',
    isCompleted: false,
    tags: [],
  });
}
