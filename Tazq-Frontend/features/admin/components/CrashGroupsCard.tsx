import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { RefreshCw, ChevronDown } from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, F, W, ICON, HAIRLINE } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { DisplayPanel, DisplayStatus } from '@/shared/components/DisplayPanel';
import { SupportService, type CrashGroup } from '@/shared/services/api';
import { swallow } from '@/shared/utils/swallow';
import { haptic } from '@/shared/utils/haptics';

/*
  ÇÖKMELER — hata başına tek satır (2026-10-31, kullanıcı: "crash log listesi çok uzun").
  Canlıda 79 kayıt / 42 farklı hata vardı; aynı hata 10 kez alt alta. Artık sunucu gruplar (CrashLog):
  satırda hata + ×kaç + son görülme + sürüm; dokununca son yığın izi ve cihaz; "Çözüldü" bütün grubu
  kapatır. Varsayılan görünüm AÇIK olanlar (iş listesi); "Tümü" geçmişi de gösterir.
  Saklama sunucuda: çözülmüş 30 gün, hepsi en çok 90 gün — kartın altında yazar.
*/

type Lang = 'tr' | 'en';
const PAGE = 15;
const COPY = {
  tr: {
    label: 'ÇÖKMELER', open: 'Açık', all: 'Tümü', refresh: 'Yenile', empty: 'Açık çökme yok.', emptyAll: 'Kayıtlı çökme yok.',
    resolve: 'Çözüldü', resolved: 'çözüldü', more: 'Daha fazla', noStack: '(yığın izi yok)', loadFail: 'Çökmeler alınamadı.',
    last: (ago: string) => `son ${ago}`, ago: (m: number) => (m < 60 ? `${m} dk önce` : m < 1440 ? `${Math.round(m / 60)} sa önce` : `${Math.round(m / 1440)} gün önce`),
    retention: (r: number, max: number) => `Çözülenler ${r} gün, hepsi en çok ${max} gün saklanır.`,
    summary: (n: number, open: boolean) => (open ? `${n} açık hata` : `${n} farklı hata`),
  },
  en: {
    label: 'CRASHES', open: 'Open', all: 'All', refresh: 'Refresh', empty: 'No open crashes.', emptyAll: 'No crashes recorded.',
    resolve: 'Resolved', resolved: 'resolved', more: 'Load more', noStack: '(no stack trace)', loadFail: 'Could not load crashes.',
    last: (ago: string) => `last ${ago}`, ago: (m: number) => (m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`),
    retention: (r: number, max: number) => `Resolved kept ${r} days, everything at most ${max} days.`,
    summary: (n: number, open: boolean) => (open ? `${n} open errors` : `${n} distinct errors`),
  },
};

export function CrashGroupsCard({ lang }: { lang: Lang }) {
  const { theme, isDark } = useAppTheme();
  const c = COPY[lang];
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [groups, setGroups] = useState<CrashGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [retention, setRetention] = useState<{ resolved: number; max: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async (reset = true) => {
    setLoading(true);
    try {
      const r = await SupportService.getCrashGroups({ limit: PAGE, offset: reset ? 0 : groups.length, unresolvedOnly: onlyOpen });
      setGroups(prev => (reset ? r.groups : [...prev, ...r.groups]));
      setTotal(r.total); setHasMore(r.hasMore); setRetention(r.retentionDays); setFailed(false);
    } catch (e) { swallow('crashGroups.load', e); setFailed(true); }
    finally { setLoading(false); }
  }, [onlyOpen, groups.length]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(true); }, [onlyOpen]);

  const resolve = async (g: CrashGroup) => {
    setBusyKey(g.errorMessage);
    try { await SupportService.resolveCrashGroup(g.errorMessage); haptic.success(); await load(true); }
    catch (e) { swallow('crashGroups.resolve', e, { capture: true }); }
    finally { setBusyKey(null); }
  };

  const now = Date.now();
  return (
    <DisplayPanel>
      <DisplayStatus label={c.label} right={
        <Touchable accessibilityRole="button" accessibilityLabel={c.refresh} accessibilityState={{ busy: loading }} onPress={() => load(true)} hitSlop={{ top: S.sm, bottom: S.sm, left: S.sm, right: S.sm }}>
          {loading ? <ActivityIndicator size="small" color={theme.onSurfaceMuted} /> : <RefreshCw size={ICON.sm} color={theme.onSurfaceMuted} />}
        </Touchable>
      } />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.sm }}>
        <Text style={{ flex: 1, fontSize: F.body, fontWeight: W.semibold, color: onlyOpen && total > 0 ? theme.error : theme.onSurface }}>{c.summary(total, onlyOpen)}</Text>
        <View style={{ width: 150 }}>
          <SegmentedControl options={[{ key: 'open', label: c.open }, { key: 'all', label: c.all }]} value={onlyOpen ? 'open' : 'all'}
            onChange={k => setOnlyOpen(k === 'open')} theme={theme} isDark={isDark} accessibilityLabel={c.label} />
        </View>
      </View>

      {failed && groups.length === 0 ? (
        <Text style={{ fontSize: F.footnote, color: theme.error }}>{c.loadFail}</Text>
      ) : groups.length === 0 && !loading ? (
        <Text style={{ fontSize: F.footnote, color: theme.onSurfaceMuted }}>{onlyOpen ? c.empty : c.emptyAll}</Text>
      ) : groups.map((g, i) => {
        const expanded = openKey === g.errorMessage;
        const ago = c.ago(Math.max(0, Math.round((now - new Date(g.lastAt).getTime()) / 60000)));
        const solved = g.unresolved === 0;
        return (
          <View key={g.errorMessage} style={{ borderTopWidth: i > 0 ? HAIRLINE : 0, borderTopColor: theme.separator, paddingVertical: S.sm, gap: S.xs }}>
            <Touchable onPress={() => setOpenKey(expanded ? null : g.errorMessage)} accessibilityRole="button" accessibilityState={{ expanded }}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.sm }}>
              <View style={{ flex: 1, gap: S.xxs }}>
                <Text numberOfLines={expanded ? undefined : 2} style={{ fontSize: F.footnote, fontWeight: W.semibold, color: solved ? theme.onSurfaceMuted : theme.onSurface }}>{g.errorMessage}</Text>
                <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted, fontVariant: ['tabular-nums'] }}>
                  ×{g.count} · {c.last(ago)}{g.latest ? ` · ${g.latest.platform} v${g.latest.appVersion}` : ''}{solved ? ` · ${c.resolved}` : ''}
                </Text>
              </View>
              <ChevronDown size={ICON.sm} color={theme.onSurfaceMuted} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
            </Touchable>
            {expanded && (
              <View style={{ gap: S.sm }}>
                <ScrollView horizontal style={{ backgroundColor: theme.surfaceContainerHigh, borderRadius: R.sm }} contentContainerStyle={{ padding: S.sm }}>
                  <Text selectable style={{ fontFamily: 'monospace', fontSize: F.caption2, color: theme.onSurfaceVariant }}>{g.latest?.stackTrace || c.noStack}</Text>
                </ScrollView>
                {g.latest && <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>{g.latest.deviceName}{g.latest.userEmail ? ` · ${g.latest.userEmail}` : ''}</Text>}
                {!solved && (
                  <Touchable onPress={() => resolve(g)} disabled={busyKey === g.errorMessage} accessibilityRole="button"
                    style={{ alignSelf: 'flex-start', paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.full, backgroundColor: theme.success + '1F' }}>
                    {busyKey === g.errorMessage ? <ActivityIndicator size="small" color={theme.success} />
                      : <Text style={{ fontSize: F.caption, fontWeight: W.bold, color: theme.success }}>{c.resolve} · ×{g.unresolved}</Text>}
                  </Touchable>
                )}
              </View>
            )}
          </View>
        );
      })}

      {hasMore && (
        <Touchable onPress={() => load(false)} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: S.sm }}>
          <Text style={{ fontSize: F.footnote, fontWeight: W.semibold, color: theme.primary }}>{c.more}</Text>
        </Touchable>
      )}
      {retention && <Text style={{ fontSize: F.caption2, color: theme.onSurfaceMuted, marginTop: S.xs }}>{c.retention(retention.resolved, retention.max)}</Text>}
    </DisplayPanel>
  );
}
