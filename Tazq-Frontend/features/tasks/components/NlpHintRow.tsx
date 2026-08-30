import React from 'react';
import { View, Text } from 'react-native';
import { Calendar, Clock, Repeat, Tag } from 'lucide-react-native';
import { S, R, F, ICON } from '@/shared/constants/tokens';
import type { AppTheme } from '@/shared/constants/Colors';

/**
 * AKILLI AYRIŞTIRICI İPUCU — "yarın 15:00 toplantı" yazınca ne anladığımızı gösterir.
 *
 * ── ÖLÇÜLEN SORUN: YARIM KALMIŞ EMOJİ TEMİZLİĞİ ───────────────────────────────
 * İpucu tek bir metin olarak kuruluyordu ve iki farklı görsel dili yan yana
 * getiriyordu: cümlenin emojisi temizlenmişti ama hemen ardından gelen bilgi
 * parçacıkları ham sistem emojisi taşıyordu —
 *
 *   "Ajandana bir etkinlik ekliyorum. Vaktinde orada olalım! (📅 31.08.2026  ⏰ 15:00  🏷️ etkinlik)"
 *
 * Aynı `Text` düğümünde bir temiz cümle ve dört ham emoji. Sistem emojisi platformdan
 * platforma farklı çiziliyor (iOS'ta başka, Android'de başka), temayı dinlemiyor ve
 * uygulamanın çizgisel ikon diline aykırı.
 *
 * ── ÇÖZÜM: PARÇALAR VERİ, İKON SUNUM ──────────────────────────────────────────
 * Metin artık emoji taşımıyor; her bilgi parçası TÜRÜYLE birlikte geliyor (tarih /
 * saat / tekrar / etiket) ve ikonu burada, tema renkleriyle çiziliyor. Ayrıştırıcı
 * ne anladığını söyler, çizim kararını sunum katmanı verir.
 */

export type NlpChipKind = 'date' | 'time' | 'repeat' | 'tag';

export type NlpChip = { kind: NlpChipKind; text: string };

export type NlpHint = { message: string; chips: NlpChip[] };

export const EMPTY_NLP_HINT: NlpHint = { message: '', chips: [] };

/** İpucunda gösterilecek bir şey var mı? */
export function hasNlpHint(hint: NlpHint): boolean {
  return !!hint.message || hint.chips.length > 0;
}

const ICONS: Record<NlpChipKind, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  date: Calendar,
  time: Clock,
  repeat: Repeat,
  tag: Tag,
};

export function NlpHintRow({ hint, theme }: { hint: NlpHint; theme: AppTheme }) {
  if (!hasNlpHint(hint)) return null;

  return (
    <View style={{ marginTop: S.sm, marginLeft: S.md, gap: S.xs }}>
      {!!hint.message && (
        <Text style={{ color: theme.primary, fontSize: F.caption, fontWeight: '600', letterSpacing: 0.5 }}>
          {hint.message}
        </Text>
      )}
      {hint.chips.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.xs }}>
          {hint.chips.map((chip, i) => {
            const Icon = ICONS[chip.kind];
            return (
              <View
                key={`${chip.kind}-${i}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: S.xs,
                  paddingHorizontal: S.sm,
                  paddingVertical: S.xxs,
                  borderRadius: R.sm,
                  backgroundColor: theme.primary + '14',
                }}
              >
                <Icon size={ICON.xs} color={theme.primary} strokeWidth={2.5} />
                <Text style={{ color: theme.primary, fontSize: F.caption, fontWeight: '600' }}>{chip.text}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
