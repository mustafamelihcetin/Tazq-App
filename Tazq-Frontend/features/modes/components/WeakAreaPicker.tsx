import React from 'react';
import { View, Text } from 'react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { S, F, R, B } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { haptic } from '@/shared/utils/haptics';
import { useModeAccent } from '@/shared/hooks/useModeAccent';
import { usePrefsStore, type PlanMode } from '../store/usePrefsStore';

/**
 * Kendi-kendine "zayıf alan" seçimi — TÜM modlarda aynı desen (başlangıçta yalnız
 * ExamCard'ın yerel `WeakTopicPicker`'ıydı; sınav dışındaki modlara (mülakat, spor,
 * tez) yayılırken buraya genelleştirildi — kod iki yerde durmasın).
 *
 * Gerçek bir sınav/mülakat sorusu SORMUYORUZ (yanlış bir soru güven kırar). Kullanıcı
 * hangi alanda zayıf olduğunu kendisi işaretler; bu seçim `pickTopic`/`pickWeightedArea`
 * tarafında 2x ağırlık kazanır — rehber hocanın "bugün zayıf olduğun konuya bakalım"
 * demesinin karşılığı.
 *
 * `options` boşsa (ör. henüz derinleştirilmemiş bir sınav) hiçbir şey render etmez —
 * eksik veri kullanıcıya görünmez, sessizce atlanır.
 */
export interface WeakAreaOption {
  id: string;
  tr: string;
  en: string;
  /** Çipleri gruplamak için (ör. sınavda ders adı). Yoksa tek grup, başlıksız. */
  groupTr?: string;
  groupEn?: string;
}

export function WeakAreaPicker({ slot, options, modeKey, label }: {
  slot: PlanMode;
  options: WeakAreaOption[];
  /** Vurgu rengi için — hangi modun paletini kullanacağını belirler (bkz. useModeAccent). */
  modeKey: string;
  /** Üstteki soru metni. Verilmezse jenerik "Zayıf olduğun alanlar var mı?" kullanılır. */
  label?: { tr: string; en: string };
}) {
  const { accent: ACCENT } = useModeAccent(modeKey);
  const { theme } = useAppTheme();
  const { language } = useLanguageStore();
  const tr = language === 'tr';
  const selected = usePrefsStore(s => s.planSpecs[slot]?.weakTopicIds) ?? [];
  const setWeakTopicIds = usePrefsStore(s => s.setWeakTopicIds);

  if (!options.length) return null;

  const grouped: { group: string; items: WeakAreaOption[] }[] = [];
  for (const o of options) {
    const groupLabel = tr ? (o.groupTr ?? '') : (o.groupEn ?? '');
    let g = grouped.find(x => x.group === groupLabel);
    if (!g) { g = { group: groupLabel, items: [] }; grouped.push(g); }
    g.items.push(o);
  }

  const toggle = (id: string) => {
    haptic.select();
    const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    setWeakTopicIds(slot, next);
  };

  const questionTr = label?.tr ?? 'Zayıf olduğun alanlar var mı? (opsiyonel)';
  const questionEn = label?.en ?? 'Any areas you feel weak in? (optional)';

  return (
    <View style={{ gap: S.sm }}>
      <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant }}>
        {tr ? questionTr : questionEn}
      </Text>
      <View style={{ gap: S.sm }}>
        {grouped.map(g => (
          <View key={g.group || '_'} style={{ gap: S.xs }}>
            {g.group ? <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceMuted }}>{g.group}</Text> : null}
            <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
              {g.items.map(o => {
                const active = selected.includes(o.id);
                return (
                  <Touchable key={o.id} onPress={() => toggle(o.id)} style={{ paddingHorizontal: S.sm + 2, paddingVertical: S.xs + 2, borderRadius: R.full, borderWidth: B.medium, borderColor: active ? ACCENT : theme.separator, backgroundColor: active ? ACCENT + '18' : 'transparent' }} activeOpacity={0.7}>
                    <Text style={{ fontSize: F.caption, fontWeight: '500', color: active ? ACCENT : theme.onSurfaceVariant }}>{tr ? o.tr : o.en}</Text>
                  </Touchable>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
