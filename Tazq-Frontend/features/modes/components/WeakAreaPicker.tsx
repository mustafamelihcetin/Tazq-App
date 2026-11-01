import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { ChevronDown } from 'lucide-react-native';
import { S, F, R, B, ICON } from '@/shared/constants/tokens';
import { Touchable } from '@/shared/components/Touchable';
import { haptic } from '@/shared/utils/haptics';
import { langOf } from '@/shared/utils/lang';
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
 *
 * UZUN LİSTE KAPALI BAŞLAR (2026-10-31): sınav müfredatı 35+ çip döküyordu; isteğe bağlı
 * bir ayrıntı kartın yarısını kaplıyordu. COLLAPSE_AT üstünde soru satırı açılır başlık olur,
 * seçim sayısı kapalıyken de görünür.
 */
const COLLAPSE_AT = 12;
const PICKED = { tr: (n: number) => `${n} seçili`, en: (n: number) => `${n} selected` };

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
  const [open, setOpen] = useState(false);

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

  const question = tr ? questionTr : questionEn;
  const collapsible = options.length > COLLAPSE_AT;
  const shown = !collapsible || open;

  return (
    <View style={{ gap: S.sm }}>
      {collapsible ? (
        <Touchable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={selected.length ? `${question}, ${PICKED[langOf(language)](selected.length)}` : question}
          onPress={() => { haptic.select(); setOpen(o => !o); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}
          activeOpacity={0.7}
        >
          <Text style={{ flex: 1, fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant }}>
            {question}
            {selected.length ? <Text style={{ color: ACCENT }}>{` · ${PICKED[langOf(language)](selected.length)}`}</Text> : null}
          </Text>
          <ChevronDown size={ICON.sm} color={theme.onSurfaceMuted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
        </Touchable>
      ) : (
        <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant }}>{question}</Text>
      )}
      {shown && <View style={{ gap: S.sm }}>
        {grouped.map(g => (
          <View key={g.group || '_'} style={{ gap: S.xs }}>
            {g.group ? <Text style={{ fontSize: F.caption, fontWeight: '500', color: theme.onSurfaceMuted }}>{g.group}</Text> : null}
            <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
              {g.items.map(o => {
                const active = selected.includes(o.id);
                return (
                  <Touchable accessibilityRole="button" accessibilityState={{ selected: active }} key={o.id} onPress={() => toggle(o.id)} style={{ paddingHorizontal: S.sm + 2, paddingVertical: S.xs + 2, borderRadius: R.full, borderWidth: B.medium, borderColor: active ? ACCENT : theme.separator, backgroundColor: active ? ACCENT + '18' : 'transparent' }} activeOpacity={0.7}>
                    <Text style={{ fontSize: F.caption, fontWeight: '500', color: active ? ACCENT : theme.onSurfaceVariant }}>{tr ? o.tr : o.en}</Text>
                  </Touchable>
                );
              })}
            </View>
          </View>
        ))}
      </View>}
    </View>
  );
}
