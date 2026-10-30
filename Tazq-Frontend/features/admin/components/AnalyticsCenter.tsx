import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, F, B, HAIRLINE } from '@/shared/constants/tokens';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { Touchable } from '@/shared/components/Touchable';
import { DisplayPanel, DisplayStatus, DisplayDivider, DisplayReadout } from '@/shared/components/DisplayPanel';
import { AdminService, type AnalyticsReport, type AdminStats, type AdminProductInsights } from '@/shared/services/api';

/*
  ANALİZ MERKEZİ (madde 9, 2026-10-30). Kullanıcı: "user odaklı değil SİSTEM ANALİZ odaklı";
  sonra "daha anlamlı, şık ve minimalist olmalı". Kurallar:
    · Her sekme TEK soruya cevap verir; başta veriden kurulan bir CÜMLE (ana sayfadaki yaşayan
      cümle gibi), altında tek ana görsel.
        Genel      — "ürün sağlıklı mı?"      → nabız paneli + kitle şeridi
        Huni       — "insanları nerede kaybediyoruz?" → en büyük kayıp vurgulu huni
        Özellikler — "ne kullanılıyor, ne keşfedilmiyor?"
        Odak       — "insanlar ne zaman, ne kadar odaklanıyor?" → gün × saat ısı haritası
    · Renk yalnız VURGU: cümlenin sözünü ettiği öğe birincil renkte, gerisi nötr.
    · Ana sayılar uygulamanın dijital ekran dilinde (DisplayPanel, eş aralıklı rakam).
  Yanıtta kişiyi tanıtan alan yok (sunucu: AnalyticsService) — "kim" değil "kaç kişi, ne yapıyor".
*/

type Lang = 'tr' | 'en';
type Tab = 'overview' | 'funnel' | 'features' | 'focus';
type Seg = string | { em: string };

const COPY = {
  tr: {
    locale: 'tr-TR', a11yTabs: 'Analiz bölümleri',
    tabs: { overview: 'Genel', funnel: 'Huni', features: 'Özellikler', focus: 'Odak' },
    loadFail: 'Analiz yüklenemedi.', retry: 'Tekrar dene', min: 'dk', hours: 'sa',
    pulse: 'NABIZ · SON 30 GÜN',
    active: 'Aktif', stickiness: 'Yapışkanlık', day7: '7. gün dönüş', newUsers: 'Yeni kayıt', focus: 'Odak', crashFree: 'Çökmesiz',
    prev: 'geçen hafta',
    audience: 'Kitle', audienceHint: 'Herkes tek grupta, son görülmeye göre',
    seg: { today: 'Bugün', week: 'Bu hafta', month: 'Bu ay', fresh: 'Yeni', dormant: 'Uykuda', oneDay: 'Bir gün kalıp gitti' },
    versions: 'Sürümler', installs: 'Kurulumlar',
    funnelHint: 'Kayıtlıların yüzde kaçı bu adıma ulaştı',
    steps: { registered: 'Kayıt', verified: 'E-posta onayı', firstTask: 'İlk görev', firstDone: 'İlk tamamlanan görev', firstFocus: 'İlk odak seansı', day7: '7. gün dönüş' } as Record<string, string>,
    cohorts: 'Haftalık kohortlar', cohortsHint: 'O hafta kaydolanların 7. gün dönüşü',
    featHint: 'Kayıtlı kullanıcıların kullananları',
    feats: { tasks: 'Görevler', focus: 'Odak', habits: 'Alışkanlıklar', modes: 'Yaşam modları', payments: 'Ödemeler', dueDates: 'Tarihli görev', recurring: 'Tekrarlayan görev', priority: 'Yüksek öncelik' } as Record<string, string>,
    modeNames: { exam: 'Sınav', tez: 'Tez', mulakat: 'Mülakat', spor: 'Spor', ramazan: 'Ramazan', tasarruf: 'Tasarruf', birakma: 'Bırakma' } as Record<string, string>,
    tasksDone: (p: number) => `görevlerin %${p}'i tamamlanmış`,
    sessions: 'Seans', avg: 'Ortalama', completion: 'Tamamlanma',
    when: 'Ne zaman', whenHint: 'Gün × saat (TR), koyu = daha çok odak',
    length: 'Seans uzunluğu', lengths: ['<10 dk', '10–24', '25–49', '50+'],
    last30: 'Son 30 gün',
    weekdays: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
    weekdaysLong: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'],
    s: {
      overview: (active: number, total: number, oneDayPct: number): Seg[] => [`${total} kişiden `, { em: String(active) }, ' kişi son 30 günde geldi; kayıtların ', { em: `%${oneDayPct}` }, ' kadarı ilk günden sonra dönmüyor.'],
      funnel: (from: string, to: string, lost: number): Seg[] => ['En büyük kayıp ', { em: `${from} → ${to}` }, ' arasında: her 100 kişiden ', { em: String(lost) }, ' kişi burada kalıyor.'],
      features: (top: string, topPct: number, low: string, lowPct: number): Seg[] => ['En çok ', { em: top }, ` kullanılıyor (%${topPct}); `, { em: low }, ` keşfedilmeyi bekliyor (%${lowPct}).`],
      focus: (day: string, hour: number, shortPct: number): Seg[] => ['Odak en çok ', { em: `${day} ${String(hour).padStart(2, '0')}:00` }, ' civarında; seansların ', { em: `%${shortPct}` }, ' kadarı 10 dakikadan kısa.'],
      focusEmpty: (): Seg[] => ['Son 30 günde odak seansı yok.'],
    },
  },
  en: {
    locale: 'en-US', a11yTabs: 'Analytics sections',
    tabs: { overview: 'Overview', funnel: 'Funnel', features: 'Features', focus: 'Focus' },
    loadFail: 'Could not load analytics.', retry: 'Retry', min: 'min', hours: 'h',
    pulse: 'PULSE · LAST 30 DAYS',
    active: 'Active', stickiness: 'Stickiness', day7: 'Day-7 return', newUsers: 'Sign-ups', focus: 'Focus', crashFree: 'Crash-free',
    prev: 'last week',
    audience: 'Audience', audienceHint: 'Everyone in one group, by last seen',
    seg: { today: 'Today', week: 'This week', month: 'This month', fresh: 'New', dormant: 'Dormant', oneDay: 'Left after day 1' },
    versions: 'Versions', installs: 'Installs',
    funnelHint: 'Share of registered users reaching each step',
    steps: { registered: 'Sign-up', verified: 'Email verified', firstTask: 'First task', firstDone: 'First task done', firstFocus: 'First focus', day7: 'Day-7 return' } as Record<string, string>,
    cohorts: 'Weekly cohorts', cohortsHint: 'Day-7 return of each sign-up week',
    featHint: 'Registered users who use it',
    feats: { tasks: 'Tasks', focus: 'Focus', habits: 'Habits', modes: 'Life modes', payments: 'Payments', dueDates: 'Dated tasks', recurring: 'Recurring tasks', priority: 'High priority' } as Record<string, string>,
    modeNames: { exam: 'Exam', tez: 'Thesis', mulakat: 'Interview', spor: 'Fitness', ramazan: 'Ramadan', tasarruf: 'Savings', birakma: 'Quitting' } as Record<string, string>,
    tasksDone: (p: number) => `${p}% of tasks completed`,
    sessions: 'Sessions', avg: 'Average', completion: 'Completion',
    when: 'When', whenHint: 'Day × hour (TR), darker = more focus',
    length: 'Session length', lengths: ['<10 min', '10–24', '25–49', '50+'],
    last30: 'Last 30 days',
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    weekdaysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    s: {
      overview: (active: number, total: number, oneDayPct: number): Seg[] => [{ em: String(active) }, ` of ${total} people came in the last 30 days; `, { em: `${oneDayPct}%` }, ' of sign-ups never return after day 1.'],
      funnel: (from: string, to: string, lost: number): Seg[] => ['Biggest drop is ', { em: `${from} → ${to}` }, ': ', { em: String(lost) }, ' of every 100 people stop here.'],
      features: (top: string, topPct: number, low: string, lowPct: number): Seg[] => [{ em: top }, ` is used most (${topPct}%); `, { em: low }, ` is waiting to be discovered (${lowPct}%).`],
      focus: (day: string, hour: number, shortPct: number): Seg[] => ['Focus peaks on ', { em: `${day}s around ${String(hour).padStart(2, '0')}:00` }, '; ', { em: `${shortPct}%` }, ' of sessions are under 10 minutes.'],
      focusEmpty: (): Seg[] => ['No focus sessions in the last 30 days.'],
    },
  },
};

const pct = (n: number, base: number) => (base > 0 ? Math.round((n / base) * 100) : 0);
/** Birincil renge 0..1 yoğunluk → hex alfa (ısı haritası, kohort hücresi). */
const alpha = (t: number, min = 0.18) => Math.round((min + (1 - min) * Math.max(0, Math.min(1, t))) * 255).toString(16).padStart(2, '0');

export function AnalyticsCenter({ lang, stats, insights }: {
  lang: Lang; stats: AdminStats | null; insights: AdminProductInsights | null;
}) {
  const { theme, colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const c = COPY[lang];
  const [tab, setTab] = useState<Tab>('overview');
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try { setReport(await AdminService.getAnalytics()); } catch { setFailed(true); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const neutral = theme.onSurface + (isDark ? '2E' : '1F');
  const faint = theme.onSurface + '0D';
  const muted = { fontSize: F.caption, color: theme.onSurfaceMuted } as const;
  const hours = (m: number) => (m < 60 ? `${m} ${c.min}` : `${(m / 60).toFixed(m < 600 ? 1 : 0)} ${c.hours}`);

  // ── Yapı taşları ──
  const Sentence = ({ parts }: { parts: Seg[] }) => (
    <Text style={{ fontSize: F.title3, lineHeight: F.title3 * 1.35, color: theme.onSurface, paddingHorizontal: S.xs }}>
      {parts.map((p, i) => (typeof p === 'string'
        ? <Text key={i}>{p}</Text>
        : <Text key={i} style={{ color: theme.primary, fontWeight: '700' }}>{p.em}</Text>))}
    </Text>
  );

  const Surface = ({ title, hint, children }: { title?: string; hint?: string; children: React.ReactNode }) => (
    <View style={{ backgroundColor: isDark ? theme.surfaceContainerHigh : theme.surfaceContainerLowest, borderRadius: R.md, borderWidth: isDark ? B.thin : 0, borderColor: theme.outline, padding: S.md, gap: S.smd }}>
      {(!!title || !!hint) && (
        <View style={{ gap: S.xxs }}>
          {!!title && <Text style={{ fontSize: F.footnote, fontWeight: '700', color: theme.onSurface }}>{title}</Text>}
          {!!hint && <Text style={muted}>{hint}</Text>}
        </View>
      )}
      {children}
    </View>
  );

  /** Etiket · ince çizgi · yüzde. Vurgulu satır birincil renkte, diğerleri nötr. */
  const Line = ({ label, value, ratio, sub, em }: { label: string; value: string; ratio: number; sub?: string; em?: boolean }) => (
    <View style={{ gap: S.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm }}>
        <Text style={{ flex: 1, fontSize: F.body, color: theme.onSurface, fontWeight: em ? '600' : '400' }}>{label}</Text>
        {!!sub && <Text style={muted}>{sub}</Text>}
        <Text style={{ minWidth: S.xl, textAlign: 'right', fontSize: F.body, fontWeight: '700', color: em ? theme.primary : theme.onSurface }}>{value}</Text>
      </View>
      <View style={{ height: S.xxs, backgroundColor: faint, borderRadius: R.full, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%`, height: '100%', backgroundColor: em ? theme.primary : neutral, borderRadius: R.full }} />
      </View>
    </View>
  );

  const Rule = () => <View style={{ height: HAIRLINE, backgroundColor: theme.separator }} />;

  // ── Genel: ürün sağlıklı mı? ──
  const renderOverview = (r: AnalyticsReport) => {
    const s = r.segments;
    const active30 = s.activeToday + s.activeWeek + s.activeMonth + s.new;
    const day7 = r.funnel.find(f => f.key === 'day7');
    const decided = s.oneDayOnly + s.activeToday + s.activeWeek + s.activeMonth + s.dormant; // "yeni"ler için karar erken
    const segs = [
      { key: 'today', n: s.activeToday, color: theme.primary },
      { key: 'week', n: s.activeWeek, color: theme.primary + 'B3' },
      { key: 'month', n: s.activeMonth, color: theme.primary + '73' },
      { key: 'fresh', n: s.new, color: theme.primary + '40' },
      { key: 'dormant', n: s.dormant, color: neutral },
      { key: 'oneDay', n: s.oneDayOnly, color: theme.error + (isDark ? '8C' : '73') },
    ] as const;
    const crashFree = r.stability.crashes7d === 0 ? 100 : r.stability.crashFreePct;
    const versions = (insights?.versions ?? []).slice(0, 3).map(v => `${v.version} %${pct(v.users, insights?.usersWithKnownVersion ?? 0)}`).join(' · ');
    const installTotal = r.platforms.reduce((a, b) => a + b.installs, 0);
    const platformName: Record<string, string> = { ios: 'iOS', android: 'Android' };
    const installs = r.platforms.map(p => `${platformName[p.platform] ?? p.platform} %${pct(p.installs, installTotal)}`).join(' · ');
    const delta = (now: number, prev: number, fmt: (n: number) => string) => `${now > prev ? '↑' : now < prev ? '↓' : '='} ${c.prev} ${fmt(prev)}`;
    return (
      <>
        <Sentence parts={c.s.overview(active30, s.total, pct(s.oneDayOnly, decided))} />
        <DisplayPanel>
          <DisplayStatus label={c.pulse} />
          <View style={{ flexDirection: 'row', gap: S.md }}>
            <DisplayReadout style={{ flex: 1 }} label={c.active} value={`${active30}/${s.total}`} />
            <DisplayReadout label={c.stickiness} value={`%${Math.round(s.stickinessPct)}`} />
            <DisplayReadout label={c.day7} value={`%${day7 ? pct(day7.users, day7.base) : 0}`} />
          </View>
          <DisplayDivider />
          <View style={{ flexDirection: 'row', gap: S.md }}>
            <View style={{ flex: 1, gap: S.xxs }}>
              <DisplayReadout label={c.newUsers} value={String(stats?.newUsers7d ?? 0)} />
              {stats && <Text style={muted}>{delta(stats.newUsers7d ?? 0, stats.newUsersPrev7d ?? 0, String)}</Text>}
            </View>
            <View style={{ flex: 1, gap: S.xxs }}>
              <DisplayReadout label={c.focus} value={hours(stats?.focusMinutes7d ?? 0)} />
              {stats && <Text style={muted}>{delta(stats.focusMinutes7d ?? 0, stats.focusMinutesPrev7d ?? 0, hours)}</Text>}
            </View>
            {crashFree != null && <DisplayReadout label={c.crashFree} value={`%${Math.round(crashFree)}`} />}
          </View>
        </DisplayPanel>
        <Surface title={c.audience} hint={c.audienceHint}>
          <View style={{ flexDirection: 'row', height: S.smd, borderRadius: R.full, overflow: 'hidden', gap: S.xxs }}>
            {segs.filter(x => x.n > 0).map(x => <View key={x.key} style={{ flex: x.n, backgroundColor: x.color }} />)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: S.sm }}>
            {segs.map(x => (
              <View key={x.key} style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingRight: S.sm }}>
                <View style={{ width: S.sm, height: S.sm, borderRadius: R.full, backgroundColor: x.color }} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: F.footnote, color: theme.onSurfaceVariant }}>{c.seg[x.key]}</Text>
                <Text style={{ fontSize: F.footnote, fontWeight: '700', color: theme.onSurface }}>{x.n}</Text>
              </View>
            ))}
          </View>
          {(!!versions || !!installs) && <Rule />}
          {!!versions && <Text style={muted}>{`${c.versions}   ${versions}`}</Text>}
          {!!installs && <Text style={muted}>{`${c.installs}   ${installs}`}</Text>}
        </Surface>
      </>
    );
  };

  // ── Huni: insanları nerede kaybediyoruz? ──
  const renderFunnel = (r: AnalyticsReport) => {
    const steps = r.funnel;
    let worst = { i: -1, drop: -1 };
    for (let i = 1; i < steps.length; i++) {
      const d = pct(steps[i - 1].users, steps[i - 1].base) - pct(steps[i].users, steps[i].base);
      if (d > worst.drop) worst = { i, drop: d };
    }
    const cohorts = (insights?.retention ?? []).filter(x => x.newUsers > 0);
    return (
      <>
        {worst.i > 0 && <Sentence parts={c.s.funnel(c.steps[steps[worst.i - 1].key], c.steps[steps[worst.i].key], worst.drop)} />}
        <Surface hint={c.funnelHint}>
          {steps.map((st, i) => (
            <Line key={st.key} label={c.steps[st.key] ?? st.key} value={`%${pct(st.users, st.base)}`} ratio={st.base > 0 ? st.users / st.base : 0}
              sub={String(st.users)} em={i === worst.i} />
          ))}
        </Surface>
        {cohorts.length > 0 && (
          <Surface title={c.cohorts} hint={c.cohortsHint}>
            <View style={{ flexDirection: 'row', gap: S.xs }}>
              {cohorts.map(k => {
                const p = pct(k.stillActiveAfter7d, k.newUsers);
                const d = k.weekStart ? new Date(`${k.weekStart}T00:00:00`) : null;
                const label = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString(c.locale, { day: 'numeric', month: 'short' }) : k.weekLabel;
                return (
                  <View key={k.weekLabel} style={{ flex: 1, alignItems: 'center', gap: S.xs }}>
                    <View style={{ width: '100%', aspectRatio: 1, borderRadius: R.sm, backgroundColor: p > 0 ? theme.primary + alpha(p / 100) : faint, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: F.caption, fontWeight: '700', color: p >= 50 ? theme.onPrimary : theme.onSurface }}>{`%${p}`}</Text>
                    </View>
                    <Text numberOfLines={1} style={muted}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </Surface>
        )}
      </>
    );
  };

  // ── Özellikler: ne kullanılıyor, ne keşfedilmiyor? ──
  const renderFeatures = (r: AnalyticsReport) => {
    const total = r.segments.total;
    const list = r.adoption;
    const top = list[0], low = list[list.length - 1];
    const modes = (insights?.modes ?? []).filter(m => m.activeUsers > 0).sort((a, b) => b.activeUsers - a.activeUsers)
      .map(m => `${c.modeNames[m.mode] ?? m.mode} ${m.activeUsers}`).join(' · ');
    const taskDonePct = stats && stats.totalTasks > 0 ? pct(stats.completedTasks, stats.totalTasks) : null;
    return (
      <>
        {top && low && top.key !== low.key && (
          <Sentence parts={c.s.features(c.feats[top.key] ?? top.key, pct(top.users, total), c.feats[low.key] ?? low.key, pct(low.users, total))} />
        )}
        <Surface hint={c.featHint}>
          {list.map(a => (
            <View key={a.key} style={{ gap: S.xxs }}>
              <Line label={c.feats[a.key] ?? a.key} value={`%${pct(a.users, total)}`} ratio={a.users / Math.max(total, 1)} sub={String(a.users)}
                em={a.key === top?.key || a.key === low?.key} />
              {a.key === 'modes' && !!modes && <Text style={muted}>{modes}</Text>}
              {a.key === 'tasks' && taskDonePct != null && <Text style={muted}>{c.tasksDone(taskDonePct)}</Text>}
            </View>
          ))}
        </Surface>
      </>
    );
  };

  // ── Odak: ne zaman, ne kadar? ──
  const renderFocus = (r: AnalyticsReport) => {
    const f = r.focus;
    const heat = f.heat && f.heat.length === 168 ? f.heat : null;
    const total = f.lengthBuckets.reduce((a, b) => a + b, 0);
    const hasData = total > 0;
    let peak = { v: -1, d: 0, h: 0 };
    if (heat) heat.forEach((v, i) => { if (v > peak.v) peak = { v, d: Math.floor(i / 24), h: i % 24 }; });
    const maxHeat = heat ? Math.max(...heat, 1) : 1;
    const maxDay = Math.max(...f.daily.map(d => d.minutes), 1);
    return (
      <>
        <Sentence parts={hasData && heat ? c.s.focus(c.weekdaysLong[peak.d], peak.h, pct(f.lengthBuckets[0], total)) : c.s.focusEmpty()} />
        <DisplayPanel>
          <DisplayStatus label={c.last30.toLocaleUpperCase(c.locale)} />
          <View style={{ flexDirection: 'row', gap: S.md }}>
            <DisplayReadout style={{ flex: 1 }} label={c.sessions} value={String(f.sessions30d)} />
            <DisplayReadout style={{ flex: 1 }} label={c.avg} value={`${f.avgMinutes} ${c.min}`} />
            <DisplayReadout label={c.completion} value={`%${pct(f.completed30d, f.sessions30d)}`} />
          </View>
        </DisplayPanel>
        {hasData && heat && (
          <Surface title={c.when} hint={c.whenHint}>
            <View style={{ gap: S.xxs }}>
              {c.weekdays.map((wd, d) => (
                <View key={wd} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                  <Text style={[muted, { width: S.lg }]}>{wd}</Text>
                  <View style={{ flex: 1, flexDirection: 'row', gap: S.xxs / 2 }}>
                    {heat.slice(d * 24, d * 24 + 24).map((v, h) => (
                      <View key={h} style={{ flex: 1, aspectRatio: 0.7, borderRadius: R.xs / 2, backgroundColor: v > 0 ? theme.primary + alpha(v / maxHeat) : faint }} />
                    ))}
                  </View>
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: S.xs }}>
                <View style={{ width: S.lg }} />
                {['00', '06', '12', '18'].map(h => <Text key={h} style={[muted, { flex: 1 }]}>{h}</Text>)}
              </View>
            </View>
          </Surface>
        )}
        {hasData && (
          <Surface title={c.length}>
            <View style={{ flexDirection: 'row', height: S.smd, borderRadius: R.full, overflow: 'hidden', gap: S.xxs }}>
              {f.lengthBuckets.map((n, i) => (n > 0 ? <View key={i} style={{ flex: n, backgroundColor: theme.primary + ['FF', 'B3', '73', '40'][i] }} /> : null))}
            </View>
            <View style={{ flexDirection: 'row' }}>
              {f.lengthBuckets.map((n, i) => (
                <View key={i} style={{ flex: 1, gap: S.xxs }}>
                  <Text style={{ fontSize: F.footnote, fontWeight: '700', color: theme.onSurface }}>{`%${pct(n, total)}`}</Text>
                  <Text style={muted}>{c.lengths[i]}</Text>
                </View>
              ))}
            </View>
          </Surface>
        )}
        {hasData && (
          <Surface title={c.last30}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: S.xxs / 2, height: S.xl }}>
              {f.daily.map(d => (
                <View key={d.date} style={{ flex: 1, height: Math.max(2, (d.minutes / maxDay) * S.xl), borderRadius: R.xs / 2, backgroundColor: d.minutes > 0 ? theme.primary : faint }} />
              ))}
            </View>
          </Surface>
        )}
      </>
    );
  };

  return (
    <View style={{ gap: S.md }}>
      <SegmentedControl<Tab>
        options={(['overview', 'funnel', 'features', 'focus'] as Tab[]).map(k => ({ key: k, label: c.tabs[k] }))}
        value={tab} onChange={setTab} theme={theme} isDark={isDark} accessibilityLabel={c.a11yTabs}
      />
      {failed ? (
        <Surface>
          <Text style={{ fontSize: F.body, color: theme.onSurfaceVariant }}>{c.loadFail}</Text>
          <Touchable onPress={load} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: S.xs }}>
            <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.primary }}>{c.retry}</Text>
          </Touchable>
        </Surface>
      ) : !report ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: S.lg }} />
      ) : tab === 'overview' ? renderOverview(report)
        : tab === 'funnel' ? renderFunnel(report)
        : tab === 'features' ? renderFeatures(report)
        : renderFocus(report)}
    </View>
  );
}
