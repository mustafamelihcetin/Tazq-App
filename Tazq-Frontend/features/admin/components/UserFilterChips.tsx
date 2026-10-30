import React from 'react';
import { ScrollView, Text } from 'react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { S, R, F, W, B } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';

/*
  KULLANICI TABLOSU FİLTRELERİ (madde 9, 2026-10-31). Arama yalnız ad/e-posta buluyordu; "kim banlı,
  kim doğrulamadı, kim hâlâ geliyor" sorusu için tüm listeyi kaydırmak gerekiyordu. Her çip sunucudaki
  bir filtredir (AdminService.ApplyUserFilter) ve kendi sayısını taşır — boş çip tıklamadan belli olur.
  Tek seçim; seçili çipe tekrar dokunmak "Tümü"ne döner.
*/

export type UserFilter = 'all' | 'active' | 'unverified' | 'banned' | 'staff' | 'deleted';

const LABELS: Record<'tr' | 'en', Record<UserFilter, string>> = {
  tr: { all: 'Tümü', active: 'Aktif · 7 gün', unverified: 'Doğrulanmamış', banned: 'Banlı', staff: 'Ekip', deleted: 'Silinmiş' },
  en: { all: 'All', active: 'Active · 7d', unverified: 'Unverified', banned: 'Banned', staff: 'Team', deleted: 'Deleted' },
};
const ORDER: UserFilter[] = ['all', 'active', 'unverified', 'banned', 'staff', 'deleted'];

export function UserFilterChips({ value, counts, total, onChange, lang }: {
  value: UserFilter; counts?: Partial<Record<UserFilter, number>> | null; total: number;
  onChange: (f: UserFilter) => void; lang: 'tr' | 'en';
}) {
  const { theme } = useAppTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.xs }} accessibilityRole="radiogroup">
      {ORDER.map(f => {
        const selected = f === value;
        const n = f === 'all' ? (value === 'all' ? total : undefined) : counts?.[f];
        return (
          <Touchable key={f} accessibilityRole="radio" accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={n != null ? `${LABELS[lang][f]}, ${n}` : LABELS[lang][f]}
            onPress={() => onChange(selected && f !== 'all' ? 'all' : f)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: S.xxs, paddingHorizontal: S.smd, paddingVertical: S.xs, borderRadius: R.full,
              borderWidth: B.thin, borderColor: selected ? theme.primary : theme.outlineVariant,
              backgroundColor: selected ? theme.primary + '1A' : 'transparent',
            }}>
            <Text style={{ fontSize: F.caption, fontWeight: W.semibold, color: selected ? theme.primary : theme.onSurfaceVariant }}>{LABELS[lang][f]}</Text>
            {n != null && <Text style={{ fontSize: F.caption, fontWeight: W.bold, color: selected ? theme.primary : theme.onSurfaceMuted, fontVariant: ['tabular-nums'] }}>{n}</Text>}
          </Touchable>
        );
      })}
    </ScrollView>
  );
}
