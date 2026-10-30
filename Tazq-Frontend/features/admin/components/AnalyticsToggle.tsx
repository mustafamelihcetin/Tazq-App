import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, F, W } from '@/shared/constants/tokens';
import { SegmentedControl } from '@/shared/components/SegmentedControl';
import { AdminService } from '@/shared/services/api';
import { swallow } from '@/shared/utils/swallow';

/*
  ANALİZE DAHİL Mİ (2026-10-31, kullanıcı: "adminler hariç olmalı, test hesaplarımız da; veya seçenek
  olmalı dahil edip etmeme gibi"). Üç durum, sunucuyla aynı kural (AdminService.Audience):
    Otomatik → normal kullanıcı dahil, ekip rolleri hariç   (include = null)
    Dahil    → her durumda sayılır                          (include = true)
    Hariç    → hiç sayılmaz — test hesapları için           (include = false)
  Altındaki satır ŞU ANKİ sonucu söyler ("Otomatik: hariç, ekip rolü") — karar görünür olsun.
*/

type Choice = 'auto' | 'in' | 'out';
const COPY = {
  tr: { title: 'Analiz', auto: 'Otomatik', in: 'Dahil', out: 'Hariç', counted: 'Analizde sayılıyor', notCounted: 'Analizde sayılmıyor', staff: 'ekip rolü', manual: 'elle seçildi', fail: 'Kaydedilemedi' },
  en: { title: 'Analytics', auto: 'Auto', in: 'Include', out: 'Exclude', counted: 'Counted in analytics', notCounted: 'Not counted in analytics', staff: 'team role', manual: 'set manually', fail: 'Could not save' },
};

export function AnalyticsToggle({ userId, role, include, lang, onChange }: {
  userId: number; role: string; include: boolean | null | undefined; lang: 'tr' | 'en';
  onChange: (include: boolean | null) => void;
}) {
  const { theme, isDark } = useAppTheme();
  const c = COPY[lang];
  const [failed, setFailed] = useState(false);
  const value: Choice = include == null ? 'auto' : include ? 'in' : 'out';
  const counted = include ?? role === 'User';
  const why = include == null ? (role === 'User' ? '' : ` · ${c.staff}`) : ` · ${c.manual}`;

  const pick = async (k: Choice) => {
    const next = k === 'auto' ? null : k === 'in';
    const prev = include ?? null;
    onChange(next); // iyimser; hata olursa geri al
    try { await AdminService.setAnalytics(userId, next); setFailed(false); }
    catch (e) { swallow('admin.setAnalytics', e); onChange(prev); setFailed(true); }
  };

  return (
    <View style={{ gap: S.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
        <Text style={{ fontSize: F.caption, fontWeight: W.bold, color: theme.onSurfaceVariant }}>{c.title}</Text>
        <View style={{ flex: 1 }}>
          <SegmentedControl options={[{ key: 'auto', label: c.auto }, { key: 'in', label: c.in }, { key: 'out', label: c.out }]}
            value={value} onChange={k => { if (k !== value) pick(k as Choice); }} theme={theme} isDark={isDark} accessibilityLabel={c.title} />
        </View>
      </View>
      <Text style={{ fontSize: F.caption, color: failed ? theme.error : theme.onSurfaceMuted }}>
        {failed ? c.fail : `${counted ? c.counted : c.notCounted}${why}`}
      </Text>
    </View>
  );
}
