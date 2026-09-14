import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { S, TABLET_MIN, WIDE_MIN, contentMaxWidth } from '@/shared/constants/tokens';

/**
 * GENİŞ EKRANDA İKİ SÜTUN, TELEFONDA TEK AKIŞ.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Uygulama tablette içeriği 600pt'lik ortalı bir sütuna sıkıştırıyordu (MAX_W) ve iki
 * yanda ekranın neredeyse yarısı kadar boş zemin kalıyordu. Teknik olarak doğruydu —
 * uzun satırlar okunmaz, sütun sınırı bunun içindir — ama SONUÇ yanlıştı: 13" bir
 * iPad'de uygulama, ortasına yapıştırılmış bir telefon gibi duruyordu.
 *
 * ── ÜÇ KADEME, İKİ EŞİK ───────────────────────────────────────────────────────
 * Tek bir "geniş mi" sorusu yetmiyor; iki ayrı soru var ve karıştırılınca sonuç ters
 * çıkıyor (çıktı da):
 *
 *   · TELEFON (<700pt)      → tek sütun, 600pt. Hiçbir şey değişmez.
 *   · DİKEY TABLET (700-1100) → tek sütun ama 760pt, listeler ızgaraya döner.
 *   · ÇOK GENİŞ (≥1100)      → sayfa İKİ SÜTUNA bölünür.
 *
 * Bölünme önce 700'de başlıyordu ve boşluğu BÜYÜTTÜ: iki sütun içeriğin boyunu yarıya
 * indirir, dikey tablette zaten üçte iki dolu olan ekran dörtte bire düştü. Bölünme
 * ancak tek sütunun yanlarda yarıdan fazla boşluk bıraktığı genişliklerde kazançlı.
 *
 * ── TELEFONDA AĞAÇ DEĞİŞMEZ ───────────────────────────────────────────────────
 * Dar ekranda `WideSplit` de `WideCol` de yalnız bir Fragment döner — ağaçta fazladan
 * tek bir View bile oluşmaz, çıktı bugünküyle birebir aynıdır. Sütun bilgisi `col`
 * alanında hep taşınıyor ama dar ekranda hiç okunmuyor; böylece iki düzen TEK bir
 * kaynaktan türüyor ve biri güncellenip öteki unutulamıyor.
 *
 * ── ÖLÇÜLER CANLI ─────────────────────────────────────────────────────────────
 * Genişlik `useWindowDimensions` ile okunuyor, `Dimensions.get()` ile değil: ilki
 * döndürmede, bölünmüş ekranda ve katlanabilir açılıp kapanınca yeniden render eder,
 * ikincisi ilk değeri dondurur.
 *
 * KULLANIM:
 *   <WideSplit>
 *     <WideCol><PlanKarti /></WideCol>
 *     <WideCol col="right">{kosul && <GunumKarti />}</WideCol>
 *   </WideSplit>
 */

export type WideColSide = 'left' | 'right';

/**
 * Tek bir yerleşim birimi.
 *
 * Geniş ekranda hangi sütuna düşeceğini söyler:
 *  · 'left'  (varsayılan) → birincil sütun: kullanıcının BAKTIĞI şey (durum, plan, skor)
 *  · 'right'             → ikincil sütun: kullanıcının YAPACAĞI şey (listeler, ritüeller)
 *
 * Varsayılanın 'left' olması bilinçli: yeni bir kart eklendiğinde sessizce sağa düşüp
 * dengeyi bozmasın, geliştirici sağa koymayı AÇIKÇA seçsin.
 */
export const WideCol: React.FC<{ col?: WideColSide; children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);

/**
 * Sayfa İKİ SÜTUNA bölünsün mü (yatay tablet, büyük katlanabilir).
 *
 * Dikey tablette FALSE döner ve bu bilinçli: bölünme içeriğin boyunu yarıya indirir,
 * orada boşluğu kapatmaz BÜYÜTÜR (bkz. tokens.ts → WIDE_MIN).
 */
export function useWideLayout() {
  const { width } = useWindowDimensions();
  return width >= WIDE_MIN;
}

/**
 * İçeriğin bu ekrandaki azami genişliği — üç kademeli (bkz. tokens → contentMaxWidth).
 *
 * Kanca olarak da veriliyor ki sayfalar `useWindowDimensions`'ı tek tek çağırıp aynı
 * hesabı kopyalamasın: sekiz ekran `maxWidth: MAX_W` yazıyordu ve tablette hepsi
 * 600pt'lik bir şeride sıkışıyordu. Bir kural, tek yer.
 */
export function useContentMaxWidth() {
  const { width } = useWindowDimensions();
  return contentMaxWidth(width);
}

/**
 * Tablet mi (dikey dahil). Sütun genişler, listeler ızgaraya döner — ama sayfa
 * bölünmez. İki kavramı ayırmak şart: "geniş" ile "tablet" aynı şey değil.
 */
export function useTabletLayout() {
  const { width } = useWindowDimensions();
  return width >= TABLET_MIN;
}

export const WideSplit: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const wide = useWideLayout();
  if (!wide) return <>{children}</>;

  const left: React.ReactNode[] = [];
  const right: React.ReactNode[] = [];

  React.Children.toArray(children).forEach((child, i) => {
    // `WideCol` dışında bir şey konursa sessizce yutulmasın: sola düşsün.
    const side: WideColSide =
      React.isValidElement(child) && child.type === WideCol
        ? ((child.props as { col?: WideColSide }).col ?? 'left')
        : 'left';
    (side === 'right' ? right : left).push(<React.Fragment key={i}>{child}</React.Fragment>);
  });

  return (
    /*
      `alignItems: 'flex-start'` ŞART. Varsayılan `stretch` kısa sütunu uzun olanın boyuna
      çeker; son kartın zemini ekranın dibine kadar uzar ve "bitmemiş" görünür. Bunlar eşit
      boylu bir ızgaranın hücreleri değil, birbirinden bağımsız iki yığın.
    */
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.md }}>
      {/* minWidth: 0 — uzun bir başlık sütunu şişirip ötekini ezmesin. */}
      <View style={{ flex: 1, minWidth: 0 }}>{left}</View>
      <View style={{ flex: 1, minWidth: 0 }}>{right}</View>
    </View>
  );
};
