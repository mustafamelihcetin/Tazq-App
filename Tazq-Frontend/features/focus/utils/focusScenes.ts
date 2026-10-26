/*
  ODAK SAHNELERİ (2026-10-25, kullanıcı: "odak sayfasında tema seçenekleri olmalı; renkler,
  tema VE animasyonlar değişmeli, en az 3 farklı").

  Her sahne üç şeyi birlikte değiştirir:
   · HAREKET — kendi shader'ı (bkz. FocusBackdrop → SCENE_EFFECTS); yalnız renk değil, biçim
   · PALET   — üç ışık rengi + iki taban rengi (üst → alt)
   · VURGU   — sayacın iki noktası ve ilerleme halkası (mola rengi ayrı kalır)

  Teknik referans: DavidHDev/react-bits arka planları (Aurora/Silk/Iridescence) — kod
  kopyalanmadı (MIT + Commons Clause); katmanlı kosinüs, alan bükme ve fbm teknikleri SkSL'de
  yeniden yazıldı. "Aurora" eski ekranın birebir aynısı: tema renklerini kullanır.
*/

export type FocusSceneId = 'aurora' | 'tide' | 'ember' | 'mist';

export interface FocusScene {
  id: FocusSceneId;
  tr: string;
  en: string;
  descTr: string;
  descEn: string;
  /** null → uygulama temasının renkleri (Aurora; eski görünüm korunur). */
  lights: [string, string, string] | null;
  base: [string, string];
  accent: string | null;
  /** Vurgu zeminindeki ikon/yazı — açık vurgularda koyu (beyaz kehribar üstünde okunmuyor). */
  onAccent: string | null;
  /** Ekran zemini (üst → orta → alt). */
  backdrop: [string, string, string];
  /** Zen modu zemini (köşeden köşeye). */
  zen: [string, string, string, string];
  /** Zen yıldızlarının tonları. */
  stars: string[];
  /**
   * Zen'de tam ekran sahnenin görünürlüğü. Aurora kendi ölçüsünde (0.3) — yeni sahnelerin
   * zemini zaten koyu; 0.3'te Kor çamurlu bir kahveye dönüyordu (kullanıcı: "boş, anlamsız").
   */
  zenOpacity: number;
  /** Zen yörüngesindeki ilerleme işareti — sahnenin kendi simgesi. */
  marker: 'star' | 'moon' | 'ember' | 'firefly';
}

export const FOCUS_SCENES: FocusScene[] = [
  { id: 'aurora', tr: 'Aurora', en: 'Aurora', descTr: 'Süzülen ışık perdeleri', descEn: 'Drifting curtains of light', lights: null, base: ['#0D1733', '#050817'], accent: null, onAccent: null, backdrop: ['#0C1024', '#080B16', '#05070F'], zen: ['#010006', '#08031D', '#13042B', '#06162D'], stars: ['#FFFFFF', '#E3F2FD', '#E0F7FA', '#FFF9C4', '#F3E5F5'], zenOpacity: 0.3, marker: 'star' },
  { id: 'tide', tr: 'Gelgit', en: 'Tide', descTr: 'Dalgalar ve su altı ışığı', descEn: 'Waves and underwater light', lights: ['#22D3EE', '#14B8A6', '#7DD3FC'], base: ['#062A3A', '#02131C'], accent: '#22D3EE', onAccent: '#0B0B0F', backdrop: ['#06243A', '#041622', '#020C14'], zen: ['#000609', '#021722', '#04293A', '#011019'], stars: ['#FFFFFF', '#CFFAFE', '#A5F3FC', '#E0F2FE'], zenOpacity: 0.95, marker: 'moon' },
  { id: 'ember', tr: 'Kor', en: 'Ember', descTr: 'Nefes alan sıcak çekirdek', descEn: 'A warm, breathing core', lights: ['#F59E0B', '#F43F5E', '#FDE68A'], base: ['#2A0F1F', '#12060E'], accent: '#F59E0B', onAccent: '#0B0B0F', backdrop: ['#24101C', '#170A12', '#0D0509'], zen: ['#060103', '#1A0610', '#2A0C14', '#120407'], stars: ['#FFF7ED', '#FDE68A', '#FDBA74', '#FECACA'], zenOpacity: 0.8, marker: 'ember' },
  { id: 'mist', tr: 'Sis', en: 'Mist', descTr: 'Ağır ağır akan orman sisi', descEn: 'Slow-moving forest mist', lights: ['#86B59A', '#4D7C6B', '#D9E8DC'], base: ['#0E1F1A', '#07110E'], accent: '#7FB89A', onAccent: '#0B0B0F', backdrop: ['#11221D', '#0B1714', '#060E0B'], zen: ['#010403', '#06120E', '#0C1F18', '#030907'], stars: ['#FFFFFF', '#E7F2EA', '#D1E7DA', '#F0FDF4'], zenOpacity: 0.95, marker: 'firefly' },
];

export const sceneOf = (id: string | null | undefined): FocusScene =>
  FOCUS_SCENES.find((s) => s.id === id) ?? FOCUS_SCENES[0];

/** Sahnenin ışıkları — Aurora uygulama temasından (eski görünüm). */
export function sceneLights(s: FocusScene, theme: { primary: string; tertiary: string; secondary: string }): [string, string, string] {
  return s.lights ?? [theme.primary, theme.tertiary, theme.secondary];
}

/** Çalışma vurgusu (halka + sayaç noktaları); mola rengi sahneden bağımsız kalır. */
export const sceneAccent = (s: FocusScene, fallback: string) => s.accent ?? fallback;

/** Odak ekranının paleti: sahnenin vurgusu ekranın ana rengi olur (düğme, rozet, ilerleme). */
export function sceneTheme<T extends { primary: string; onPrimary: string; background: string }>(s: FocusScene, base: T): T {
  if (!s.accent) return base;
  // Zemin de sahnenin tabanından: daire içindeki dünya ekranın kenarına kadar sürsün.
  return { ...base, primary: s.accent, onPrimary: s.onAccent ?? base.onPrimary, background: s.backdrop[1] };
}

const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** a'yı b'ye t oranında karıştırır (0 → a, 1 → b); düz 6 haneli hex döner. */
export function mixHex(a: string, b: string, t: number): string {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * ODAK EKRANINDAN AÇILAN PENCERELERİN PALETİ (2026-10-25, kullanıcı: "Kor seçmiştim ama
 * seans sonu penceresi mavi klasik temada geldi"). Seans sonu, nefes/görev seçici, modlar.
 *
 * Bu pencereler UYGULAMANIN zemininde açılır (açık temada açık). Kehribar/camgöbeği beyaz
 * zeminde METİN olarak okunmaz → açık zeminde vurgunun koyulaştırılmış tonu (beyaz yazıyla),
 * koyu zeminde parlak hâli (koyu yazıyla). Konteyner rengi zemine karışmış DÜZ hex — çağıranlar
 * üstüne alfa ekliyor ('60'), 8 haneli hex'e ikinci alfa eklenemez.
 */
export function sceneSheetTheme<T extends { primary: string; onPrimary: string; primaryContainer: string; onPrimaryContainer: string; surface: string }>(s: FocusScene, base: T, isDark: boolean): T {
  if (!s.accent) return base;
  const primary = isDark ? s.accent : mixHex(s.accent, '#000000', 0.42);
  return {
    ...base,
    primary,
    onPrimary: isDark ? (s.onAccent ?? base.onPrimary) : '#FFFFFF',
    primaryContainer: mixHex(s.accent, base.surface, isDark ? 0.78 : 0.84),
    onPrimaryContainer: isDark ? s.accent : mixHex(s.accent, '#000000', 0.55),
  };
}

/*
  IŞIK TOPLAMA (2026-10-25, odak "oyunu"): her LIGHT_MINUTES odak dakikası sahnenin bir ışığı
  (Aurora yıldız · Gelgit inci · Kor kor tanesi · Sis ateşböceği). AYRI KAYIT YOK — odak
  dakikalarından türetilir; geçmiş, eşitleme ve katı mod (sayılmayan seans) kendiliğinden doğru.
*/
export const LIGHT_MINUTES = 5;
export const MAX_RING_LIGHTS = 18; // 90 dk — daire çevresinde rahat sığan en çok ışık
export const lightsFor = (minutes: number) => Math.max(0, Math.floor(minutes / LIGHT_MINUTES));

export const LIGHT_NAMES: Record<FocusSceneId, { tr: string; en: string; enOne: string }> = {
  aurora: { tr: 'yıldız', en: 'stars', enOne: 'star' },
  tide: { tr: 'inci', en: 'pearls', enOne: 'pearl' },
  ember: { tr: 'kor', en: 'embers', enOne: 'ember' },
  mist: { tr: 'ateşböceği', en: 'fireflies', enOne: 'firefly' },
};
