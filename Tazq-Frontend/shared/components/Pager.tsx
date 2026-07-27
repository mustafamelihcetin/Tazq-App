import React from 'react';
import { View, Text } from 'react-native';
import { Touchable } from '@/shared/components/Touchable';
import { S, R, F, B } from '@/shared/constants/tokens';
import { useAppTheme } from '@/shared/hooks/useAppTheme';

/**
 * SAYFALAMA DENETİMİ — admin panelindeki tüm listeler için tek kaynak.
 *
 * NEDEN BİLEŞEN: panelde üç ayrı liste var (sunucu logları, kilitlenmeler, denetim
 * günlüğü) ve üçünde de aynı kusur vardı — sunucu N kayıt gönderiyor, istemci bir kez
 * daha kırpıp M tanesini çiziyordu. Yani kayıtlar VARDI ama görülemiyordu:
 *
 *   loglar        500 tutuluyor → 200 isteniyor → 60 çiziliyor
 *   denetim       100 isteniyor → 40 çiziliyor
 *   kilitlenmeler 15 isteniyor  → gerisi yok
 *
 * Üç yere ayrı ayrı sayfalama yazmak, üç ayrı davranış demekti (biri "Sonraki"yi boşta
 * bırakır, biri sayfa numarasını yanlış sayar). Tek bileşen bunu imkânsız kılıyor.
 *
 * `total` ZORUNLU: onsuz "sonraki sayfa var mı?" bilinemez ve düğme kullanıcıyı boş
 * sayfaya tıklatır — sayfalamanın en sinir bozucu hâli budur.
 */

export interface PagerProps {
  /** Sıfır tabanlı geçerli sayfa. */
  page: number;
  pageSize: number;
  /** Filtre uygulandıktan SONRAKİ toplam kayıt sayısı. */
  total: number;
  /** Sunucunun bildirdiği "daha var mı" — son sayfada düğme gerçekten kapansın. */
  hasMore: boolean;
  onChange: (page: number) => void;
  tr: boolean;
}

export const Pager = React.memo<PagerProps>(({ page, pageSize, total, hasMore, onChange, tr }) => {
  const { theme } = useAppTheme();

  /**
   * `total === -1` → sunucu toplamı BİLDİRMEDİ (eski sürüm). Bu durumda denetim yine
   * gösterilir, yalnız aralık yerine sayfa numarası yazılır.
   *
   * Eskiden bilinmeyen toplam `items.length` sayılıyordu ve tam dolu bir sayfa
   * geldiğinde `total === pageSize` olup denetim KENDİNİ GİZLİYORDU — yani özellik
   * eksiksiz çalışıyorken kullanıcıya "sayfalama yok" gibi görünüyordu. Bir özelliğin
   * en kötü hâli, var olup görünmemesidir.
   */
  const unknownTotal = total < 0;

  // Tek sayfaya sığıyorsa denetim GÖSTERİLMEZ. Boş bir "1-12 / 12" satırı bilgi
  // vermez, yalnız yer kaplar. Toplam bilinmiyorsa bu karar verilemez → gösterilir.
  if (!unknownTotal && total <= pageSize) return null;

  const first = page * pageSize + 1;
  const last = unknownTotal ? first + pageSize - 1 : Math.min((page + 1) * pageSize, total);
  const atStart = page === 0;

  const btn = (disabled: boolean) => ({
    paddingHorizontal: S.md,
    paddingVertical: S.xs,
    borderRadius: R.full,
    backgroundColor: theme.surfaceContainerHigh,
    // Devre dışı düğme SİLİNMİYOR, soluklaşıyor: kaybolsaydı düğmelerin yeri
    // değişir ve kullanıcı her sayfada hedefi yeniden arardı.
    opacity: disabled ? 0.4 : 1,
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: S.sm,
        borderTopWidth: B.thin,
        borderTopColor: theme.outlineVariant,
      }}
    >
      <Touchable
        disabled={atStart}
        onPress={() => onChange(Math.max(0, page - 1))}
        accessibilityRole="button"
        accessibilityLabel={tr ? 'Önceki sayfa' : 'Previous page'}
        accessibilityState={{ disabled: atStart }}
        style={btn(atStart)}
      >
        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700' }}>
          {tr ? 'Önceki' : 'Prev'}
        </Text>
      </Touchable>

      {/* Aralık + toplam: "kaçıncı sayfadayım" değil "neyin neresindeyim" sorusunun
          cevabı. Sayfa numarası tek başına toplamı bilmeden anlamsızdır. */}
      <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '600' }}>
        {unknownTotal ? `${tr ? 'Sayfa' : 'Page'} ${page + 1}` : `${first}–${last} / ${total}`}
      </Text>

      <Touchable
        disabled={!hasMore}
        onPress={() => onChange(page + 1)}
        accessibilityRole="button"
        accessibilityLabel={tr ? 'Sonraki sayfa' : 'Next page'}
        accessibilityState={{ disabled: !hasMore }}
        style={btn(!hasMore)}
      >
        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700' }}>
          {tr ? 'Sonraki' : 'Next'}
        </Text>
      </Touchable>
    </View>
  );
});

Pager.displayName = 'Pager';
