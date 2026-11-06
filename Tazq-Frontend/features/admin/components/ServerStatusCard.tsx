import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, F, W, ICON } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { DisplayPanel, DisplayStatus, DisplayDivider, useDisplayColors } from '@/shared/components/DisplayPanel';
import { AdminSystemService, type ServerStatusData } from '@/shared/services/api';

/*
  SUNUCU DURUMU (2026-11-06, kullanıcı: "düzenli kontrol olsun, sürekli uğraşmayalım, admin panelde görelim"). Ölçümü sunucudaki bakım betiği 5 dakikada bir yapar (ops/tazq-maint.py).
  Tek soru: "her şey yolunda mı?" Cevap başlıkta; altında servis listesi, son 24 saatin izi (Uptime Kuma'nın kalp atışı çubuğu) ve karar verdiren sayılar. Sorun varsa ayrıca e-posta gider (bkz. ServerWatchService).
*/
type Lang = 'tr' | 'en';
const COPY = {
  tr: {
    locale: 'tr-TR', label: 'SUNUCU', refresh: 'Sunucu durumunu yenile', loadFail: 'Sunucu durumu alınamadı.', allOk: 'Her şey yolunda', issues: (n: number) => `${n} konu dikkat istiyor`,
    cpu: 'İşlemci', memory: 'Bellek', disk: 'Disk', free: (g: number) => `${g} GB boş`, full: (d: number) => `Bu hızla ${d} günde dolar`,
    capacity: 'Genel kapasite', capOverall: (n: string, l: string, left: string) => `${n} / yaklaşık ${l} kullanıcı · ${left} kişi daha`, capBy: { load: 'İlk anlık yük sınırına gelinir', data: 'İlk veritabanı sınırına gelinir' }, capLoad: 'Anlık yük', capLoadValue: (l: string) => `aynı anda yaklaşık ${l} kişi`, capNow: (n: string) => `Son 5 dakikada ${n} kişi`, capData: 'Veritabanı', capDataValue: (l: string) => `yaklaşık ${l} kullanıcılık yer`, capDataBy: { disk: 'Sınırı disk belirliyor', cloud: 'Sınırı bulut yedeği belirliyor' }, capNote: 'Tahminidir, yük testiyle ölçülmedi: gerçek sayı 2-3 kat farklı çıkabilir.', database: 'Veritabanı', localBackup: 'Sunucu yedeği', cloudBackup: 'Bulut yedeği', cache: 'Temizlenebilir', cleaned: 'Son temizlik', freed: (m: number) => `${m} MB açıldı`,
    day: 'Son 24 saat', dayNote: (n: number) => `${n} saatin ölçümü`, names: { 'tazq-backend': 'Uygulama sunucusu', 'tazq-db': 'Veritabanı', 'tazq-redis': 'Önbellek', 'tazq-proxy': 'Web geçidi' } as Record<string, string>, up: 'Çalışıyor', down: 'Sorunlu',
    guard: 'Son 1 saatte reddedilen', guardValue: (r: string, b: string) => `${r} istek · ${b} engel`,
    measured: 'Ölçüm', never: 'henüz yok', ago: (min: number) => (min < 1 ? 'az önce' : min < 60 ? `${min} dk önce` : min < 1440 ? `${Math.round(min / 60)} sa önce` : `${Math.round(min / 1440)} gün önce`),
    warn: {
      disk_critical: 'Disk %90\'ı geçti, veritabanı yazamaz hale gelebilir.', disk_high: 'Disk %80\'i geçti.', disk_filling: 'Disk bu hızla 14 günden kısa sürede dolacak.',
      memory_high: 'Bellek %90\'ı geçti.', cpu_high: 'İşlemci yükü sürekli yüksek.', container_down: 'Bir servis çalışmıyor ya da sağlıksız.',
      backup_late: 'Son 26 saatte sunucu yedeği alınamadı.', cloud_backup_late: 'Son 26 saatte bulut yedeği gönderilemedi.', cloud_backup_skipped: 'Bulut yedeği boyut sınırına takıldı.',
      abuse_detected: 'Son bir saatte aşırı istek gönderen bir kaynak geçici olarak engellendi. Saldırı olabilir; kayıtlara bak.',
      status_stale: 'Bakım betiği 15 dakikadır ölçüm yazmıyor.', status_missing: 'Durum dosyası okunamıyor. Bakım betiğini kontrol et.',
    } as Record<string, string>,
  },
  en: {
    locale: 'en-US', label: 'SERVER', refresh: 'Refresh server status', loadFail: 'Could not load server status.', allOk: 'All good', issues: (n: number) => `${n} item${n > 1 ? 's' : ''} need attention`,
    cpu: 'CPU', memory: 'Memory', disk: 'Disk', free: (g: number) => `${g} GB free`, full: (d: number) => `Full in ${d} days at this rate`,
    capacity: 'Overall capacity', capOverall: (n: string, l: string, left: string) => `${n} / about ${l} users · ${left} more`, capBy: { load: 'Live load is the first limit', data: 'Database is the first limit' }, capLoad: 'Live load', capLoadValue: (l: string) => `about ${l} at once`, capNow: (n: string) => `${n} in the last 5 minutes`, capData: 'Database', capDataValue: (l: string) => `room for about ${l} users`, capDataBy: { disk: 'Limited by disk', cloud: 'Limited by cloud backup' }, capNote: 'An estimate, not load-tested: the real number can differ 2-3x.', database: 'Database', localBackup: 'Server backup', cloudBackup: 'Cloud backup', cache: 'Reclaimable', cleaned: 'Last cleanup', freed: (m: number) => `${m} MB freed`,
    day: 'Last 24 hours', dayNote: (n: number) => `${n} hours measured`, names: { 'tazq-backend': 'App server', 'tazq-db': 'Database', 'tazq-redis': 'Cache', 'tazq-proxy': 'Web gateway' } as Record<string, string>, up: 'Running', down: 'Problem',
    guard: 'Rejected in the last hour', guardValue: (r: string, b: string) => `${r} requests · ${b} blocks`,
    measured: 'Measured', never: 'none yet', ago: (min: number) => (min < 1 ? 'just now' : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`),
    warn: {
      disk_critical: 'Disk is over 90%; the database may stop writing.', disk_high: 'Disk is over 80%.', disk_filling: 'Disk will fill in under 14 days at this rate.',
      memory_high: 'Memory is over 90%.', cpu_high: 'CPU load is persistently high.', container_down: 'A service is down or unhealthy.',
      backup_late: 'No server backup in the last 26 hours.', cloud_backup_late: 'No cloud backup in the last 26 hours.', cloud_backup_skipped: 'Cloud backup hit its size limit.',
      abuse_detected: 'A source sending excessive requests was temporarily blocked in the last hour. It may be an attack; check the logs.',
      status_stale: 'The maintenance script has not reported for 15 minutes.', status_missing: 'Status file unreadable. Check the maintenance script.',
    } as Record<string, string>,
  },
};

const minutesSince = (iso: string | null | undefined) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : null);

function Meter({ label, pct, note }: { label: string; pct: number; note: string }) {
  const { theme } = useAppTheme();
  const color = pct >= 90 ? theme.error : pct >= 80 ? theme.warning : theme.primaryFill;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${label}, ${note}`} accessibilityValue={{ now: Math.round(pct), min: 0, max: 100 }} style={{ gap: S.xxs }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm }}>
        <Text style={{ flex: 1, fontSize: F.footnote, fontWeight: W.medium, color: theme.onSurface }}>{label}</Text>
        <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, fontVariant: ['tabular-nums'], color: theme.onSurface }}>%{Math.round(pct)}</Text>
      </View>
      <View style={{ height: 6, borderRadius: R.full, backgroundColor: theme.surfaceContainerHigh, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${Math.min(100, Math.max(1, pct))}%`, borderRadius: R.full, backgroundColor: color }} />
      </View>
      {!!note && <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{note}</Text>}
    </View>
  );
}

/** Saat başına bir çizgi: yeşil sorunsuz, kırmızı uyarı vardı, soluk ölçüm yok. */
function DayTrace({ history, label, note }: { history: { t: number; ok: boolean }[]; label: string; note: string }) {
  const { theme } = useAppTheme();
  const slots = Array.from({ length: 24 }, (_, i) => history[history.length - 24 + i]);
  const bad = history.filter(h => !h.ok).length;
  return (
    <View accessible accessibilityLabel={`${label}: ${note}, ${bad}`} style={{ gap: S.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm }}>
        <Text style={{ flex: 1, fontSize: F.footnote, fontWeight: W.medium, color: theme.onSurface }}>{label}</Text>
        <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{note}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: S.xxs, height: 20 }}>
        {slots.map((h, i) => <View key={i} style={{ flex: 1, borderRadius: R.xs, backgroundColor: !h ? theme.surfaceContainerHigh : h.ok ? theme.success : theme.error }} />)}
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const dc = useDisplayColors();
  const { theme } = useAppTheme();
  return (
    <View accessible style={{ flexDirection: 'row', alignItems: 'baseline', gap: S.sm }}>
      <Text style={{ flex: 1, fontSize: F.footnote, color: dc.label }} numberOfLines={1}>{label}</Text>
      <Text style={{ fontSize: F.footnote, fontWeight: W.medium, fontVariant: ['tabular-nums'], color: theme.onSurface }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export function ServerStatusCard({ lang }: { lang: Lang }) {
  const { theme } = useAppTheme();
  const dc = useDisplayColors();
  const c = COPY[lang];
  const [data, setData] = useState<ServerStatusData | null>(null);
  const [failed, setFailed] = useState<number | true | false>(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await AdminSystemService.server()); setFailed(false); }
    catch (e) { setFailed((e as { response?: { status?: number } })?.response?.status ?? true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const num = (n: number) => n.toLocaleString(c.locale);
  const ago = (iso: string | null | undefined) => { const m = minutesSince(iso); return m == null ? c.never : c.ago(m); };
  const warnings = data?.warnings ?? [];
  const reclaim = data?.cache ? Math.round((data.cache.buildGb + data.cache.journalMb / 1024) * 10) / 10 : 0;

  return (
    <DisplayPanel>
      <DisplayStatus label={c.label} right={
        <Touchable accessibilityRole="button" accessibilityLabel={c.refresh} accessibilityState={{ busy: loading }} onPress={load} hitSlop={{ top: S.sm, bottom: S.sm, left: S.sm, right: S.sm }}>
          {loading ? <ActivityIndicator size="small" color={dc.label} /> : <RefreshCw size={ICON.sm} color={dc.label} />}
        </Touchable>
      } />
      {failed && !data ? (
        <Text style={{ fontSize: F.footnote, color: theme.error }}>{c.loadFail}{typeof failed === 'number' ? ` (${failed})` : ''}</Text>
      ) : data && (
        <>
          <View accessible accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
            <View style={{ width: S.md, height: S.md, borderRadius: R.full, backgroundColor: warnings.length ? theme.error : theme.success }} />
            <Text style={{ flex: 1, fontSize: F.subhead, fontWeight: W.bold, color: warnings.length ? theme.error : theme.onSurface }}>{warnings.length ? c.issues(warnings.length) : c.allOk}</Text>
          </View>
          {warnings.map(w => <Text key={w} style={{ fontSize: F.footnote, color: theme.error }}>{c.warn[w] ?? w}</Text>)}
          {data.available && data.disk && data.memory && data.load && (
            <>
              <DisplayDivider spacing={S.smd} />
              <View style={{ gap: S.xs }}>
                {(data.containers ?? []).map(x => {
                  const ok = x.status === 'running' && x.health !== 'unhealthy';
                  return (
                    <View key={x.name} accessible accessibilityLabel={`${c.names[x.name] ?? x.name}: ${ok ? c.up : c.down}`} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                      <View style={{ width: S.sm, height: S.sm, borderRadius: R.full, backgroundColor: ok ? theme.success : theme.error }} />
                      <Text style={{ flex: 1, fontSize: F.footnote, color: theme.onSurface }} numberOfLines={1}>{c.names[x.name] ?? x.name}</Text>
                      <Text style={{ fontSize: F.footnote, fontWeight: W.medium, color: ok ? theme.onSurfaceVariant : theme.error }}>{ok ? c.up : c.down}</Text>
                    </View>
                  );
                })}
              </View>
              {data.capacity && data.database?.users != null && (
                <>
                  <DisplayDivider spacing={S.smd} />
                  <View style={{ gap: S.xs }}>
                    <Meter label={c.capacity} pct={(data.database.users / Math.max(1, data.capacity.overallUsers)) * 100} note={c.capOverall(num(data.database.users), num(data.capacity.overallUsers), num(Math.max(0, data.capacity.overallUsers - data.database.users)))} />
                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.capBy[data.capacity.limitedBy]}</Text>
                    <View style={{ height: S.xs }} />
                    <Row label={c.capLoad} value={c.capLoadValue(num(data.capacity.concurrentLimit))} />
                    {data.database.activeNow != null && <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.capNow(num(data.database.activeNow))}</Text>}
                    <Row label={c.capData} value={c.capDataValue(num(data.capacity.dataUsers))} />
                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{c.capDataBy[data.capacity.dataLimitedBy]}</Text>
                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, paddingTop: S.xs }}>{c.capNote}</Text>
                  </View>
                </>
              )}
              <DisplayDivider spacing={S.smd} />
              <DayTrace history={data.history ?? []} label={c.day} note={c.dayNote((data.history ?? []).length)} />
              <DisplayDivider spacing={S.smd} />
              <View style={{ gap: S.smd }}>
                <Meter label={c.disk} pct={data.disk.pct} note={[c.free(data.disk.freeGb), data.disk.daysToFull != null ? c.full(data.disk.daysToFull) : ''].filter(Boolean).join(' · ')} />
                <Meter label={c.memory} pct={data.memory.pct} note="" />
                <Meter label={c.cpu} pct={data.load.cpuPct} note="" />
              </View>
              <DisplayDivider spacing={S.smd} />
              <View style={{ gap: S.xs }}>
                {data.database?.sizeMb != null && <Row label={c.database} value={`${data.database.sizeMb} MB`} />}
                <Row label={c.localBackup} value={ago(data.backups?.localLast)} />
                <Row label={c.cloudBackup} value={ago(data.backups?.cloudLast)} />
                <Row label={c.cache} value={`${reclaim} GB`} />
                <Row label={c.cleaned} value={data.maintenance ? `${ago(data.maintenance.at)} · ${c.freed(data.maintenance.freedMb)}` : c.never} />
                {data.abuse && <Row label={c.guard} value={c.guardValue(num(data.abuse.rejectedLastHour), num(data.abuse.blocksLastHour))} />}
                <Row label={c.measured} value={ago(data.at)} />
              </View>
            </>
          )}
        </>
      )}
    </DisplayPanel>
  );
}
