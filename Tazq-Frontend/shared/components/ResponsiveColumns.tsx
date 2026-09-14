import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { S, WIDE_MIN } from '@/shared/constants/tokens';

/**
 * GENİŞ EKRANDA İKİ SÜTUN, TELEFONDA TEK AKIŞ.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Uygulama tablette içeriği 600pt'lik ortalı bir sütuna sıkıştırıyordu (MAX_W) ve iki
 * yanda ekranın neredeyse yarısı kadar boş zemin kalıyordu. Teknik olarak doğruydu —
 * uzun satırlar okunmaz, sütun sınırı bunun içindir — ama SONUÇ yanlıştı: 13" bir
 * iPad'de uygulama, ortasına yapıştırılmış bir telefon gibi duruyordu.
 *
 * ── NEDEN İKİ SÜTUN, NEDEN DAHA GENİŞ TEK SÜTUN DEĞİL ─────────────────────────
 * Sütunu 900pt'ye açmak boşluğu kapatırdı ama okunurluğu bozardı: bir görev satırının
 * solundaki onay kutusuyla sağındaki saat arasında yarım ekran boşluk kalır, göz ikisini
 * birbirine bağlayamaz. iPadOS uygulamaları (Anımsatıcılar, Fitness, Takvim) bu yüzden
 * genişliği SATIRI uzatmak için değil, İKİNCİ BİR SÜTUN açmak için kullanır. Kartların
 * kendi genişliği telefondakine yakın kalır; değişen tek şey yan yana kaç tane
 * durduğudur.
 *
 * ── TELEFONDA HİÇBİR ŞEY DEĞİŞMEZ ─────────────────────────────────────────────
 * Eşik 700pt, en geniş telefon ~440pt. Dar ekranda `WideSplit` de `WideCol` de yalnız
 * bir Fragment döner — yani ağaçta fazladan tek bir View bile oluşmaz, çıktı bugünküyle
 * birebir aynıdır. Sütun bilgisi `col` alanında hep taşınıyor ama dar ekranda hiç
 * okunmuyor; böylece iki düzen TEK bir kaynaktan türüyor ve biri güncellenip öteki
 * unutulamıyor.
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

export function useWideLayout() {
  const { width } = useWindowDimensions();
  return width >= WIDE_MIN;
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
