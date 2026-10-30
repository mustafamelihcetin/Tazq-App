import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, F, W, ICON } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { DisplayPanel, DisplayStatus, DisplayDivider, useDisplayColors } from '@/shared/components/DisplayPanel';
import { AdminSystemService, type JobHealthEntry } from '@/shared/services/api';

/*
  ARKA PLAN İŞLERİ (madde 9, 2026-10-31). Sunucudaki zamanlanmış işler (hesap temizleme, admin
  kayıt özeti) ve mail kuyruğu yalnız log yazıyordu; biri günlerce sessizce düşse panelden
  görünmezdi. Tek soru: "hepsi çalışıyor mu?" — başlıkta cevap, satırda her işin son turu.
  Durum yalnız renkle değil SÖZLE de söylenir (Çalışıyor / Hata / Gecikiyor / Bekliyor).
  Sayaçlar süreç başlangıcından beri (sunucu bellekte tutar; bkz. JobHealth.cs).
*/

type Lang = 'tr' | 'en';
const COPY = {
  tr: {
    label: 'ARKA PLAN İŞLERİ', refresh: 'İşleri yenile', loadFail: 'İş durumu alınamadı.',
    allOk: (n: number) => `${n} iş · hepsi çalışıyor`, issues: (n: number) => `${n} işte sorun var`,
    names: { 'account-purge': 'Hesap temizleme', 'signup-digest': 'Günlük kayıt özeti', 'mail-queue': 'Mail kuyruğu', 'crash-retention': 'Çökme kaydı temizliği' } as Record<string, string>,
    states: { ok: 'Çalışıyor', failing: 'Hata', late: 'Gecikiyor', waiting: 'Bekliyor' } as Record<string, string>,
    every: (m: number) => (m >= 60 ? `${Math.round(m / 60)} saatte bir` : `${Math.round(m)} dk'da bir`),
    onEvent: 'iş geldikçe',
    never: 'henüz çalışmadı', ran: (ago: string) => `son tur ${ago}`,
    ago: (min: number) => (min < 1 ? 'az önce' : min < 60 ? `${min} dk önce` : min < 1440 ? `${Math.round(min / 60)} sa önce` : `${Math.round(min / 1440)} gün önce`),
    runs: (r: number, f: number) => `${r} tur · ${f} hata`, pending: (n: number) => `${n} bekliyor`,
  },
  en: {
    label: 'BACKGROUND JOBS', refresh: 'Refresh jobs', loadFail: 'Could not load job status.',
    allOk: (n: number) => `${n} jobs · all running`, issues: (n: number) => `${n} job${n > 1 ? 's' : ''} need attention`,
    names: { 'account-purge': 'Account purge', 'signup-digest': 'Daily signup digest', 'mail-queue': 'Mail queue', 'crash-retention': 'Crash log cleanup' } as Record<string, string>,
    states: { ok: 'Running', failing: 'Error', late: 'Late', waiting: 'Waiting' } as Record<string, string>,
    every: (m: number) => (m >= 60 ? `every ${Math.round(m / 60)} h` : `every ${Math.round(m)} min`),
    onEvent: 'on demand',
    never: 'not run yet', ran: (ago: string) => `last run ${ago}`,
    ago: (min: number) => (min < 1 ? 'just now' : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`),
    runs: (r: number, f: number) => `${r} runs · ${f} errors`, pending: (n: number) => `${n} pending`,
  },
};

export function JobHealthCard({ lang }: { lang: Lang }) {
  const { theme } = useAppTheme();
  const dc = useDisplayColors();
  const c = COPY[lang];
  const [jobs, setJobs] = useState<JobHealthEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setJobs(await AdminSystemService.jobs()); setFailed(false); }
    catch { setFailed(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const tone = (state: string) => state === 'ok' ? theme.success : state === 'failing' ? theme.error : state === 'late' ? theme.warning : dc.label;
  const bad = (jobs ?? []).filter(j => j.state === 'failing' || j.state === 'late').length;
  const now = Date.now();

  return (
    <DisplayPanel>
      <DisplayStatus label={c.label} right={
        <Touchable accessibilityRole="button" accessibilityLabel={c.refresh} accessibilityState={{ busy: loading }} onPress={load} hitSlop={{ top: S.sm, bottom: S.sm, left: S.sm, right: S.sm }}>
          {loading ? <ActivityIndicator size="small" color={dc.label} /> : <RefreshCw size={ICON.sm} color={dc.label} />}
        </Touchable>
      } />
      {failed && !jobs ? (
        <Text style={{ fontSize: F.footnote, color: theme.error }}>{c.loadFail}</Text>
      ) : jobs && (
        <>
          <Text style={{ fontSize: F.body, fontWeight: W.semibold, color: bad ? theme.error : theme.onSurface }}>
            {bad ? c.issues(bad) : c.allOk(jobs.length)}
          </Text>
          <DisplayDivider spacing={S.smd} />
          <View style={{ gap: S.smd }}>
            {jobs.map(j => {
              const col = tone(j.state);
              const ago = j.lastRunAt ? c.ran(c.ago(Math.max(0, Math.round((now - new Date(j.lastRunAt).getTime()) / 60000)))) : c.never;
              const cadence = j.intervalMinutes > 0 ? c.every(j.intervalMinutes) : c.onEvent;
              return (
                <View key={j.key} accessible accessibilityLabel={`${c.names[j.key] ?? j.key}: ${c.states[j.state] ?? j.state}, ${ago}`} style={{ gap: S.xxs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                    <View style={{ width: S.sm, height: S.sm, borderRadius: R.full, backgroundColor: col }} />
                    <Text style={{ flex: 1, fontSize: F.body, fontWeight: W.medium, color: theme.onSurface }} numberOfLines={1}>{c.names[j.key] ?? j.key}</Text>
                    <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: col }}>{c.states[j.state] ?? j.state}</Text>
                  </View>
                  <Text style={{ marginLeft: S.sm + S.sm, fontSize: F.caption, color: dc.label, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
                    {[ago, cadence, c.runs(j.runs, j.failures), j.pending ? c.pending(j.pending) : ''].filter(Boolean).join(' · ')}
                  </Text>
                  {j.state === 'failing' && !!j.lastError && (
                    <Text style={{ marginLeft: S.sm + S.sm, fontSize: F.caption, color: theme.error }} numberOfLines={2}>{j.lastError}</Text>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}
    </DisplayPanel>
  );
}
