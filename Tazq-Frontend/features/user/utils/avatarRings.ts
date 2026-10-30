import { AccentPalettes, accentOf, type AccentId } from '@/shared/constants/Colors';

/*
  PROFİL ÇERÇEVESİ = VURGU RENGİ (2026-10-31, kullanıcı: "vurgu rengi ile profil çerçevesi
  birleşse mi?"). İkisi de aynı soruyu soruyordu — "senin rengin ne?" — ama iki ayrı paletle:
  11 tonluk halka paleti (kehribar, adaçayı, mercan… durum renkleriyle çakışan tonlar dahil)
  ve 7 tonluk vurgu ailesi. Sonuç: kehribar çerçeve + lavanta arayüz yan yana.
  Şimdi tek seçim: çerçeve VAR/YOK'tur, rengi her zaman vurgu rengidir. Hoş Geldin'de ya da
  Profil'de renk seçmek uygulamanın vurgusunu da seçer.

  Sunucu kolonu (AvatarBorderColor, hex) korunur: 'transparent' = yok; doluysa çerçeve var
  (yazarken o anki vurgunun açık tonu yazılır — eski istemciler de anlamlı bir renk görür).
  Kayıtlı eski renkler (ör. kehribar) artık "var" demektir ve vurgu rengiyle çizilir.
*/

export const RING_NONE = 'transparent';

export const hasRing = (color: string | null | undefined): color is string =>
  !!color && color !== RING_NONE;

export type RingChoice = 'none' | AccentId;

export interface RingOption { key: RingChoice; color: string; tr: string; en: string }

/** "Yok" + vurgu ailesi — o temadaki tonla. */
export const ringOptions = (isDark: boolean): RingOption[] => [
  { key: 'none', color: RING_NONE, tr: 'Yok', en: 'None' },
  ...AccentPalettes.map(a => ({ key: a.id, color: (isDark ? a.dark : a.light).primary, tr: a.label.tr, en: a.label.en })),
];

/** Sunucuya yazılan değer. */
export const ringStoreValue = (choice: RingChoice): string =>
  choice === 'none' ? RING_NONE : accentOf(choice).light.primary;
