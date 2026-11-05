/*
  ODAK SAHNELERİ (2026-10-25, kullanıcı: "odak sayfasında tema seçenekleri olmalı; renkler,
  tema VE animasyonlar değişmeli, en az 3 farklı").

  Her sahne üç şeyi birlikte değiştirir:
   · HAREKET — kendi shader'ı (bkz. FocusBackdrop → SCENE_EFFECTS); yalnız renk değil, biçim
   · PALET   — üç ışık rengi + iki taban rengi (üst → alt)
   · VURGU   — sayacın iki noktası ve ilerleme halkası (mola rengi ayrı kalır)

  Teknik referans: DavidHDev/react-bits arka planları (Aurora/Silk/Iridescence) — kod
  kopyalanmadı (MIT + Commons Clause); katmanlı kosinüs, alan bükme ve fbm teknikleri SkSL'de
  yeniden yazıldı.
  Aurora 2026-11-05 (kullanıcı: "kimse bu aurora demez"): tema rengi ve yatay bulanık şeritler bırakıldı; yeşilden mora asılı perdeler, dikey ışınlar, yıldızlar, karlı dağlar, göl yansıması. Vurgu (halka, düğme) yine temadan.
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
   * Zen'de tam ekran sahnenin görünürlüğü. Zeminler zaten koyu; düşük değerde sahne kayboluyor
   * (0.3'te Kor çamurlu kahve, Aurora görünmezdi).
   */
  zenOpacity: number;
  /** Zen yörüngesindeki ilerleme işareti — sahnenin kendi simgesi. */
  marker: 'star' | 'moon' | 'ember' | 'firefly';
}

export const FOCUS_SCENES: FocusScene[] = [
  { id: 'aurora', tr: 'Aurora', en: 'Aurora', descTr: 'Odaklandıkça gök açılır, takımyıldız çizilir', descEn: 'Focus opens the sky and draws a constellation', lights: ['#34F5A0', '#16C7B8', '#B25CF6'], base: ['#0A1230', '#03060F'], accent: null, onAccent: null, backdrop: ['#0C1024', '#080B16', '#05070F'], zen: ['#010006', '#08031D', '#13042B', '#06162D'], stars: ['#FFFFFF', '#E3F2FD', '#E0F7FA', '#FFF9C4', '#F3E5F5'], zenOpacity: 0.95, marker: 'star' },
  { id: 'tide', tr: 'Gelgit', en: 'Tide', descTr: 'Odaklandıkça ışık dibe iner, inci birikir', descEn: 'Focus sends light down; pearls gather below', lights: ['#22D3EE', '#14B8A6', '#7DD3FC'], base: ['#062A3A', '#02131C'], accent: '#22D3EE', onAccent: '#0B0B0F', backdrop: ['#06243A', '#041622', '#020C14'], zen: ['#000609', '#021722', '#04293A', '#011019'], stars: ['#FFFFFF', '#CFFAFE', '#A5F3FC', '#E0F2FE'], zenOpacity: 0.95, marker: 'moon' },
  { id: 'ember', tr: 'Kor', en: 'Ember', descTr: 'Odaklandıkça tarla tutuşur, kor birikir', descEn: 'Focus lights the field; embers gather', lights: ['#FFB35C', '#D9793A', '#FFE7C2'], base: ['#2E1D12', '#140C07'], accent: '#F59E0B', onAccent: '#0B0B0F', backdrop: ['#2E1D12', '#1E130B', '#140C07'], zen: ['#100904', '#1E130B', '#2A1A0F', '#140C07'], stars: ['#FFF7ED', '#FDE68A', '#FDBA74', '#FECACA'], zenOpacity: 0.95, marker: 'ember' },
  { id: 'mist', tr: 'Sis', en: 'Mist', descTr: 'Odaklandıkça sis kalkar, ateşböceği gelir', descEn: 'Focus lifts the mist; fireflies arrive', lights: ['#86B59A', '#3F6F62', '#F0DDA8'], base: ['#0E1F1A', '#07110E'], accent: '#7FB89A', onAccent: '#0B0B0F', backdrop: ['#11221D', '#0B1714', '#060E0B'], zen: ['#010403', '#06120E', '#0C1F18', '#030907'], stars: ['#FFFFFF', '#E7F2EA', '#D1E7DA', '#F0FDF4'], zenOpacity: 0.95, marker: 'firefly' },
];

/** Sahnenin doğal sesi: gelgitte okyanus, korda şömine. Öneridir, seçim kullanıcının. */
export const SCENE_SOUND: Record<FocusSceneId, { id: 'wind' | 'ocean' | 'fireplace' | 'forest'; tr: string; en: string }> = {
  aurora: { id: 'wind', tr: 'Rüzgar', en: 'Wind' },
  tide: { id: 'ocean', tr: 'Okyanus', en: 'Ocean' },
  ember: { id: 'fireplace', tr: 'Şömine', en: 'Fireplace' },
  mist: { id: 'forest', tr: 'Orman', en: 'Forest' },
};

/** Sahnenin doğal sesi listede önde. */
export const withSceneSoundFirst = <T extends string>(sounds: T[], first: string): T[] =>
  [...sounds.filter((x) => x === first), ...sounds.filter((x) => x !== first)];

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

/** Zen'de ilerleme bu adımlarla yazılır (FocusTide'ın görünmezken seyrek güncelleme fikri). */
export const SPARSE_STEP_SEC = 15;

export const sparseProgress = (total: number, seconds: number, sparse: boolean): number => {
  if (total <= 0) return 0;
  const elapsed = total - seconds;
  return (sparse ? Math.floor(elapsed / SPARSE_STEP_SEC) * SPARSE_STEP_SEC : elapsed) / total;
};

/** Dünyaya işlenen en çok parça (shader döngüsü); halkadaki sayıdan bağımsız. */
export const MAX_WORLD_LIGHTS = 12;

/**
 * Seansın dünyaya yansıması (bkz. useSceneWorld). Molada null: dünya olduğu gibi kalır.
 * Boşta active=false, sahne tam görünür. Duraklatınca geri gitmez; ceza yok.
 */
export function worldFor(s: { isActive: boolean; seconds: number; totalSeconds: number; pomodoroPhase: 'work' | 'break'; sessionKind?: 'focus' | 'break'; run?: { doneSeconds: number; plannedSeconds: number } | null }): { active: boolean; growth: number; lights: number } | null {
  if (s.pomodoroPhase === 'break' || s.sessionKind === 'break') return null;
  const started = s.isActive || s.seconds < s.totalSeconds;
  if ((!started && !s.run?.doneSeconds) || s.totalSeconds <= 0) return { active: false, growth: 1, lights: 0 };
  const elapsed = (s.run?.doneSeconds ?? 0) + (started ? s.totalSeconds - s.seconds : 0);
  const planned = s.run?.plannedSeconds ?? s.totalSeconds;
  return { active: true, growth: Math.min(1, elapsed / planned), lights: Math.min(MAX_WORLD_LIGHTS, lightsFor(elapsed / 60)) };
}

/** Seans özetinde dünyanın geldiği yer: tamamlanınca yüzde söylenmez. */
export const WORLD_RESULT: Record<'tr' | 'en', Record<FocusSceneId, (pct: number) => string>> = {
  tr: {
    aurora: (p) => (p >= 100 ? 'Gökyüzü tamamen açıldı' : `Gökyüzü %${p} açıldı`),
    tide: (p) => (p >= 100 ? 'Işık dibe ulaştı' : `Işık %${p} derine indi`),
    ember: (p) => (p >= 100 ? 'Kor tarlası tutuştu' : `Kor tarlası %${p} tutuştu`),
    mist: (p) => (p >= 100 ? 'Sis tamamen kalktı' : `Sis %${p} kalktı`),
  },
  en: {
    aurora: (p) => (p >= 100 ? 'The sky opened fully' : `The sky opened ${p}%`),
    tide: (p) => (p >= 100 ? 'The light reached the seabed' : `The light went ${p}% deep`),
    ember: (p) => (p >= 100 ? 'The ember field caught fire' : `The ember field ${p}% alight`),
    mist: (p) => (p >= 100 ? 'The mist lifted completely' : `The mist lifted ${p}%`),
  },
};

export const LIGHT_NAMES: Record<FocusSceneId, { tr: string; en: string; enOne: string }> = {
  aurora: { tr: 'yıldız', en: 'stars', enOne: 'star' },
  tide: { tr: 'inci', en: 'pearls', enOne: 'pearl' },
  ember: { tr: 'kor', en: 'embers', enOne: 'ember' },
  mist: { tr: 'ateşböceği', en: 'fireflies', enOne: 'firefly' },
};
