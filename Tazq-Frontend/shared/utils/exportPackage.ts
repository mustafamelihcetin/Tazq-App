/**
 * DIŞA AKTARMA PAKETİ — temizleme hattı (madde 8).
 *
 * Eskiden depoların ham nesneleri olduğu gibi dosyaya yazılıyordu: kullanıcı ve görev
 * kimlikleri, sıralama/eşitleme alanları, sistem etiketleri ('archived', 'weight_entry'…)
 * ve tercih deposunun TAMAMI (plan kimlik listeleri, tur durumu — iç şema). Dosya
 * WhatsApp'tan paylaşılabilen bir şey; iç yapıyı da taşımamalı.
 *
 * KURAL: İZİN LİSTESİ. Her kayıt türü burada tek tek adı yazılmış alanlara yansıtılır;
 * listede olmayan hiçbir alan pakete giremez. Yasak listesi değil — depoya yarın eklenen
 * bir alan, biri buraya bilerek yazana kadar dışarıda kalır.
 *
 * Saf fonksiyon: depolara dokunmaz, girdiyi alır, paketi döndürür (bkz. dataExport).
 */

/** Ham girdiler — depolardan okunmuş, dokunulmamış. */
export interface ExportSources {
  user?: { name?: string | null; email?: string | null } | null;
  tasks?: Array<{
    title: string; description?: string | null; dueDate?: string | null; dueTime?: string | null;
    isCompleted?: boolean; completedAt?: string | null; priority?: string | null; tags?: string[] | null;
    subtasks?: Array<{ title?: string; text?: string; done?: boolean; isCompleted?: boolean }> | null;
    recurrence?: string | null; isArchived?: boolean;
  }> | null;
  habits?: Array<{ name: string; nameTr?: string; nameEn?: string; createdAt?: string; completedDates?: string[]; skippedDates?: string[] }> | null;
  focusSessions?: Array<{ startedAt: string; minutes: number }> | null;
  achievements?: { unlocked?: string[]; unlockedAt?: Record<string, number> } | null;
  momentum?: Array<{ date: string; score: number }> | null;
  weight?: Array<{ date: string; weight: number }> | null;
  budget?: { budgetType?: string; startAmount?: string; targetAmount?: string; log?: Array<{ date: string; amount: number }> } | null;
  quit?: Array<{ type: string; name: string; start: string; relapses?: string[]; bestStreak?: number }> | null;
  subjects?: Record<string, { lastStudied?: string }> | null;
  payments?: Array<{ title: string; amount: number; dueDay?: number; recurrence?: string; nextDueDate?: string | null; category?: string | null }> | null;
  currency?: string | null;
  preferences?: Record<string, unknown> | null;
  language: 'tr' | 'en';
  theme?: string | null;
}

export interface ExportDeps {
  /** Sistem görevlerinin anahtar başlığını kullanıcının diline çevirir. */
  localizeTitle: (task: { title: string; description?: string | null }) => string;
  /** Kullanıcı etiketleri (iç/ikon etiketleri elenir). */
  visibleTags: (tags?: string[] | null) => string[];
  isSomeday: (task: { tags?: string[] | null }) => boolean;
  /** Başarım anahtarının kullanıcının dilindeki adı ('first_task' → 'İlk Adım Atıldı!'). */
  achievementName?: (id: string) => string | null;
}

/** Tercihlerden YALNIZ bunlar — kullanıcının kendi seçtiği, anlamı açık ayarlar. */
const PREFERENCE_ALLOWLIST = ['soundEffects', 'hapticFeedback', 'focusBreathMode', 'focusAmbientSound', 'focusPreset', 'focusKeepAwake', 'focusAutoZen', 'uiMode'] as const;

const pad = (n: number) => String(n).padStart(2, '0');
/** Yerel gün 'YYYY-MM-DD' (ISO saat damgası UTC'de bir önceki güne kayabilir). */
const localDay = (iso?: string | null): string | null => {
  if (!iso || iso.startsWith('0001')) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const localTime = (iso?: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const arr = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);
/** Boş alanları atar: paket okunurken "null" gürültüsü olmasın. */
const compact = <T extends Record<string, unknown>>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))) as Partial<T>;

export const EXPORT_FORMAT_VERSION = 2;

export function buildExportPackage(src: ExportSources, deps: ExportDeps, now: Date = new Date()) {
  const tr = src.language === 'tr';
  const focus = arr(src.focusSessions).map(s => compact({ date: localDay(s.startedAt), start: localTime(s.startedAt), minutes: s.minutes }));
  const prefs = src.preferences ?? {};

  return {
    format: 'tazq-export',
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    profile: compact({ name: src.user?.name ?? null, email: src.user?.email ?? null }),
    tasks: arr(src.tasks).map(t => compact({
      title: deps.localizeTitle(t),
      notes: t.description?.trim() || null,
      dueDate: localDay(t.dueDate),
      dueTime: localTime(t.dueTime),
      priority: t.priority ? t.priority.toLowerCase() : null,
      status: t.isCompleted ? 'completed' : 'open',
      completedOn: t.isCompleted ? localDay(t.completedAt) : null,
      archived: t.isArchived ? true : null,
      someday: deps.isSomeday(t) ? true : null,
      tags: deps.visibleTags(t.tags),
      repeat: t.recurrence && t.recurrence !== 'None' ? t.recurrence.toLowerCase() : null,
      subtasks: arr(t.subtasks).map(st => ({ title: st.title ?? st.text ?? '', done: !!(st.done ?? st.isCompleted) })),
    })),
    habits: arr(src.habits).map(h => compact({
      name: (tr ? h.nameTr : h.nameEn) || h.name,
      startedOn: localDay(h.createdAt),
      doneOn: arr(h.completedDates),
      restDays: arr(h.skippedDates),
    })),
    focus: { totalMinutes: focus.reduce((n, s) => n + (s.minutes ?? 0), 0), sessions: focus },
    achievements: arr(src.achievements?.unlocked).map(id => compact({ achievement: id, name: deps.achievementName?.(id) ?? null, unlockedOn: localDay(src.achievements?.unlockedAt?.[id] ? new Date(src.achievements.unlockedAt[id]).toISOString() : null) })),
    momentum: arr(src.momentum).map(m => ({ date: m.date, score: m.score })),
    weight: arr(src.weight).map(w => ({ date: w.date, kg: w.weight })),
    savings: src.budget && arr(src.budget.log).length > 0 ? compact({
      kind: src.budget.budgetType,
      start: src.budget.startAmount,
      target: src.budget.targetAmount,
      entries: arr(src.budget.log).map(e => ({ date: e.date, amount: e.amount })),
    }) : null,
    quit: arr(src.quit).map(q => compact({ name: q.name, kind: q.type, cleanSince: q.start, relapses: arr(q.relapses), bestStreakDays: q.bestStreak })),
    study: Object.entries(src.subjects ?? {}).map(([subject, p]) => compact({ subject, lastStudied: p?.lastStudied })),
    payments: arr(src.payments).map(p => compact({
      title: p.title, amount: p.amount, currency: src.currency ?? null,
      dayOfMonth: p.dueDay, repeat: p.recurrence ? p.recurrence.toLowerCase() : null,
      nextDue: localDay(p.nextDueDate), category: p.category ?? null,
    })),
    preferences: compact({
      language: src.language,
      theme: src.theme ?? null,
      currency: src.currency ?? null,
      ...Object.fromEntries(PREFERENCE_ALLOWLIST.filter(k => k in prefs).map(k => [k, prefs[k]])),
    }),
  };
}

export type ExportPackage = ReturnType<typeof buildExportPackage>;

/** Kayıt sayısı — kullanıcıya "ne kadar veri" olduğunu söylemek için. */
export function countRecords(p: ExportPackage): number {
  return p.tasks.length + p.habits.length + p.focus.sessions.length + p.achievements.length
    + p.momentum.length + p.weight.length + (p.savings?.entries?.length ?? 0) + p.quit.length
    + p.study.length + p.payments.length;
}

/** Okunabilir sürüm — teknik olmayan kullanıcı için aynı paketin Markdown hâli. */
export function exportToMarkdown(p: ExportPackage, lang: 'tr' | 'en'): string {
  const L = MD_COPY[lang];
  const out: string[] = [`# ${L.title}`, '', `${L.exportedAt}: ${p.exportedAt.slice(0, 10)}`, ''];
  if (p.profile.name || p.profile.email) out.push(`**${L.profile}:** ${[p.profile.name, p.profile.email].filter(Boolean).join(' · ')}`, '');
  const section = (h: string, rows: string[]) => { if (rows.length) out.push(`## ${h} (${rows.length})`, '', ...rows, ''); };

  section(L.tasks, p.tasks.map(t => {
    const meta = [t.dueDate && `${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ''}`, t.priority && (L.priority[t.priority as keyof typeof L.priority] ?? t.priority), t.repeat, t.tags?.map(x => `#${x}`).join(' ')].filter(Boolean).join(' · ');
    const lines = [`- [${t.status === 'completed' ? 'x' : ' '}] ${t.title}${meta ? ` — ${meta}` : ''}${t.archived ? ` _(${L.archived})_` : ''}`];
    if (t.notes) lines.push(`  > ${t.notes.replace(/\n/g, '\n  > ')}`);
    (t.subtasks ?? []).forEach(st => lines.push(`  - [${st.done ? 'x' : ' '}] ${st.title}`));
    return lines.join('\n');
  }));
  section(L.habits, p.habits.map(h => `- ${h.name} — ${(h.doneOn ?? []).length} ${L.daysDone}`));
  if (p.focus.sessions.length) out.push(`## ${L.focus}`, '', `${L.totalFocus}: ${p.focus.totalMinutes} ${L.min} · ${p.focus.sessions.length} ${L.sessions}`, '');
  section(L.payments, p.payments.map(x => `- ${x.title} — ${x.amount}${x.currency ? ` ${x.currency}` : ''}${x.dayOfMonth ? ` · ${L.day} ${x.dayOfMonth}` : ''}`));
  section(L.weight, p.weight.map(w => `- ${w.date}: ${w.kg} kg`));
  section(L.quit, p.quit.map(q => `- ${q.name} — ${L.cleanSince} ${q.cleanSince}`));
  section(L.achievements, p.achievements.map(a => `- ${a.name ?? a.achievement}${a.unlockedOn ? ` (${a.unlockedOn})` : ''}`));
  out.push('---', L.footer);
  return out.join('\n');
}

const MD_COPY = {
  tr: { title: 'TAZQ verilerim', exportedAt: 'Dışa aktarma tarihi', profile: 'Profil', tasks: 'Görevler', archived: 'arşivde', habits: 'Alışkanlıklar', daysDone: 'gün yapıldı', focus: 'Odak', totalFocus: 'Toplam odak', min: 'dk', sessions: 'seans', payments: 'Ödemeler', day: 'her ayın', weight: 'Kilo kaydı', quit: 'Bırakma', cleanSince: 'temiz:', achievements: 'Başarılar', priority: { high: 'yüksek öncelik', medium: 'orta öncelik', low: 'düşük öncelik' }, footer: 'Tüm ayrıntılar aynı paketin JSON sürümünde.' },
  en: { title: 'My TAZQ data', exportedAt: 'Exported on', profile: 'Profile', tasks: 'Tasks', archived: 'archived', habits: 'Habits', daysDone: 'days done', focus: 'Focus', totalFocus: 'Total focus', min: 'min', sessions: 'sessions', payments: 'Payments', day: 'day', weight: 'Weight log', quit: 'Quitting', cleanSince: 'clean since', achievements: 'Achievements', priority: { high: 'high priority', medium: 'medium priority', low: 'low priority' }, footer: 'Full details are in the JSON version of this export.' },
} as const;
