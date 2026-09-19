import type { ParsedHint } from '@/features/tasks/utils/taskParser';

/**
 * TASLAK DENETİMİ — motor ne zaman forma yazabilir, ne zaman yazamaz.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Görev formu başlıktaki HER tuşta ayrıştırıcıyı çalıştırıp formun üstüne yazıyordu:
 *  · önceliği elle "Yüksek" yapıp başlığa bir kelime ekleyince öncelik geri dönüyordu,
 *  · elle eklenen etiketler bir sonraki tuşta SİLİNİYORDU,
 *  · başlıktan "yarın" silinince tarih yerinde kalıyordu (cümle ile form ayrışıyordu),
 *  · kullanıcının kaldırdığı otomatik etiket bir sonraki tuşta geri geliyordu.
 *
 * ── KURAL: ELLE SEÇİLEN HER ZAMAN KAZANIR ─────────────────────────────────────
 *  · Kullanıcının dokunduğu alan (öncelik, tarih, saat, tekrar, hatırlatma) artık
 *    KULLANICININ: motor bir daha o alana yazmaz.
 *  · Dokunulmamış alanlar CÜMLENİN aynasıdır: "yarın" yazılırsa tarih gelir,
 *    silinirse gider.
 *  · Motorun eklediği etiketi kullanıcı kaldırırsa o etiket bu taslakta REDDEDİLMİŞ
 *    sayılır ve bir daha eklenmez. Kullanıcının kendi etiketlerine motor dokunmaz.
 */

export type OwnedField = 'priority' | 'dueDate' | 'dueTime' | 'recurrence' | 'reminder';

export interface DraftControl {
  /** Kullanıcının elle belirlediği alanlar. */
  manual: OwnedField[];
  /** Motorun şu an forma koyduğu etiketler. */
  autoTags: string[];
  /** Kullanıcının kaldırdığı otomatik etiketler. */
  rejected: string[];
}

export const EMPTY_DRAFT: DraftControl = { manual: [], autoTags: [], rejected: [] };

export interface DraftForm {
  priority: string;
  dueDate: string;
  dueTime: string | null;
  recurrence: string;
  tags: string[];
  reminderEnabled: boolean;
}

const REMINDER_TAGS = ['hatırlatıcı', 'reminder'];

/** Motorun anladıklarını forma uygular — yalnız kullanıcının dokunmadığı yerlere. */
export function applyHint<F extends DraftForm>(form: F, hint: ParsedHint, draft: DraftControl): { form: F; draft: DraftControl } {
  const free = (f: OwnedField) => !draft.manual.includes(f);
  const next = { ...form };
  // Genel F üzerinden yazılamıyor (F['priority'] daha dar bir tip olabilir); değerler
  // DraftForm sözleşmesine uygun, bu yüzden o görünümden yazılıyor.
  const w: DraftForm = next;
  if (free('priority')) w.priority = hint.priority ?? 'Medium';
  if (free('dueDate')) w.dueDate = hint.dueDate ?? '';
  if (free('dueTime')) w.dueTime = hint.dueTime ?? null;
  if (free('recurrence')) w.recurrence = hint.recurrence ?? 'None';
  const auto = (hint.tags ?? []).filter((t) => !draft.rejected.includes(t));
  // Kullanıcının (ve sistemin) etiketleri korunur; yalnız motorun kendi eskileri yenilenir.
  const kept = form.tags.filter((t) => !draft.autoTags.includes(t));
  w.tags = Array.from(new Set([...kept, ...auto]));
  if (free('reminder')) w.reminderEnabled = auto.some((t) => REMINDER_TAGS.includes(t));
  return { form: next, draft: { ...draft, autoTags: auto } };
}

/** Kullanıcı bu alana dokundu — motor artık yazamaz. */
export function markManual(draft: DraftControl, ...fields: OwnedField[]): DraftControl {
  const add = fields.filter((f) => !draft.manual.includes(f));
  return add.length ? { ...draft, manual: [...draft.manual, ...add] } : draft;
}

/** Kullanıcı bir etiketi kaldırdı: motorunsa reddedilir, bir daha eklenmez. */
export function rejectTag(draft: DraftControl, tag: string): DraftControl {
  if (!draft.autoTags.includes(tag)) return draft;
  return { ...draft, autoTags: draft.autoTags.filter((t) => t !== tag), rejected: [...draft.rejected, tag] };
}

/** Çiplerde yalnız motorun GERÇEKTEN uyguladığı şey gösterilir. */
export function visibleHint(hint: ParsedHint, draft: DraftControl): ParsedHint {
  const v: ParsedHint = { ...hint };
  if (draft.manual.includes('priority')) delete v.priority;
  if (draft.manual.includes('dueDate')) delete v.dueDate;
  if (draft.manual.includes('dueTime')) delete v.dueTime;
  if (draft.manual.includes('recurrence')) { delete v.recurrence; delete v.recurrenceDay; }
  if (v.tags) v.tags = v.tags.filter((t) => !draft.rejected.includes(t));
  return v;
}
