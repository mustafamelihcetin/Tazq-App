/*
  PLANIN İMZASI: her hedefin kendi ölçüsünü kendi biçimiyle çizen görselin hesabı (bkz. PlanSignature). Süs yok: sınavda bir kitap = bir ders,
  bırakmada bir yaprak = geçilen eşik, tasarrufta su seviyesi = biriken pay, Ramazan'da ayın hâli = ayın günü.
*/

/** Geçilen eşik sayısı: temiz gün ≥ eşik. */
export const passedMilestones = (days: number, milestones: readonly number[]): number => milestones.filter(m => days >= m).length;

/** Sarmaşığın boyu (0-1). Düğümler eşit aralıklı; iki eşik arasında gerçek orana göre ilerler, uydurma ilerleme yok. */
export function vineProgress(days: number, milestones: readonly number[]): number {
  const n = milestones.length;
  if (n < 2) return 0;
  const passed = passedMilestones(days, milestones);
  if (passed >= n) return 1;
  if (passed === 0) return 0;
  const prev = milestones[passed - 1];
  const next = milestones[passed];
  return (passed - 1 + (days - prev) / (next - prev)) / (n - 1);
}

/** Ramazan'ın kaçıncı günü. Süre bilinmiyorsa 30. */
export const ramadanDay = (daysRemaining: number, duration: number): number => {
  const d = duration > 0 ? duration : 30;
  return Math.max(1, Math.min(d, d - daysRemaining + 1));
};

/** Ayın aydınlık payı: 1. gün ince hilal, ortada dolunay, sonda yine hilal. */
export const moonIllumination = (day: number, duration = 30): number => {
  const t = Math.max(0, Math.min(1, day / Math.max(1, duration)));
  return Math.sin(Math.PI * t);
};

/** Yüzde eşiğinin gerçek değeri: başlangıçtan hedefe doğrusal (kilo ve birikim). */
export const valueAtPct = (start: number, target: number, pct: number): number => start + ((target - start) * pct) / 100;

/** Sabit tohumlu sayı: yığın düzensiz görünür ama her çizimde aynıdır, eklenince eskiler yerinde kalır. */
const noise = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/**
 * Penceredeki sikke yığını: üst üste, yamuk yatmış. Sıra alttan yukarı (doluş sırası = çizim sırası, yeni gelen üste biner). Ortası kenarından yüksek: dökülmüş para.
 */
export function coinHeap({ x, y, w, h, rx, ry }: { x: number; y: number; w: number; h: number; rx: number; ry: number }): { x: number; y: number; angle: number }[] {
  const out: { x: number; y: number; angle: number; lift: number }[] = [];
  const perRow = Math.max(3, Math.round(w / (rx * 1.15)));
  const rows = Math.ceil((h + ry) / (ry * 1.25));
  for (let row = 0; row < rows; row++) {
    for (let k = 0; k < perRow; k++) {
      const n = row * perRow + k;
      const u = (k + 0.5 + (noise(n) - 0.5) * 0.9) / perRow;
      const cx = x + u * w;
      // Tepecik: orta sütunlar bir sıra yukarıda biter.
      const hump = (1 - Math.abs(u - 0.5) * 2) * ry * 1.6;
      const lift = row * ry * 1.25 + hump * Math.min(1, row / 2) + (noise(n + 91) - 0.5) * ry * 1.1;
      out.push({ x: cx, y: y + h - ry * 0.5 - lift, angle: (noise(n + 37) - 0.5) * 0.85, lift });
    }
  }
  return out.sort((a, b) => a.lift - b.lift).map(({ x: cx, y: cy, angle }) => ({ x: cx, y: cy, angle }));
}

/** Görünen para sayısı: hiç para yoksa boş, hedefe varmadan küp tam dolu görünmez. */
export function coinsFor(pct: number, capacity: number): number {
  const p = Math.max(0, Math.min(1, pct));
  if (p <= 0 || capacity <= 0) return 0;
  if (p >= 1) return capacity;
  return Math.max(1, Math.min(capacity - 1, Math.round(p * capacity)));
}

// ── Sahne hesapları (bkz. PlanScenes). Worklet: UI iş parçacığında karede çağrılır. ──
export type Lut = { x: number[]; y: number[]; d: number[]; total: number };

/** Çizginin uzunluk tablosu: nokta, Skia'nın uzunluğa göre kırptığı çizginin ucunda kalsın. */
export function polyLut(pts: { x: number; y: number }[]): Lut {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { x: pts.map(p => p.x), y: pts.map(p => p.y), d, total: d[d.length - 1] };
}

export function lutAt(l: Lut, t: number): { x: number; y: number } {
  'worklet';
  const target = Math.max(0, Math.min(1, t)) * l.total;
  let lo = 0; let hi = l.d.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (l.d[m] <= target) lo = m; else hi = m; }
  const span = l.d[hi] - l.d[lo] || 1;
  const f = (target - l.d[lo]) / span;
  return { x: l.x[lo] + (l.x[hi] - l.x[lo]) * f, y: l.y[lo] + (l.y[hi] - l.y[lo]) * f };
}

/** Basamakta konum: düzde yürür (along), son %30'da sıçrayıp bir üste çıkar (rise, hop). */
export function stepPosition(pos: number): { step: number; along: number; rise: number; hop: number } {
  'worklet';
  const step = Math.floor(pos);
  const f = pos - step;
  const jump = f > 0.7 ? (f - 0.7) / 0.3 : 0;
  return { step, along: f, rise: jump, hop: Math.sin(jump * Math.PI) };
}

/** Haftada çalışılan gün → yan başına plaka (bar dengede kalsın). */
export const platesPerSide = (days: number, slots: number): number => Math.max(0, Math.min(slots, Math.ceil(days / 2)));

/** Ödenen pay → kopan halka. Bir kuruş ödenmeden halka kopmaz, borç bitmeden zincir tamamen gitmez. */
export function chainPaid(pct: number, links: number): number {
  const p = Math.max(0, Math.min(1, pct));
  if (p <= 0) return 0;
  if (p >= 1) return links;
  return Math.min(links - 1, Math.max(1, Math.floor(p * links)));
}

/**
 * Kitaplık rafı: kalınlık konu sayısından (karekökle: büyük ders öteki kitapları ezmesin), boy sabit tohumla farklı. Toplam genişlik rafa oturur; en çok `maxW` kalın.
 * 45 konu = 45 yuvarlak yerine 5 ders = 5 kitap: tek bakışta hangi ders ne durumda görünür.
 */
export function shelfLayout(books: { done: number; total: number }[], width: number, height: number, gap = 4, maxW = 72): { x: number; w: number; h: number; share: number }[] {
  const weights = books.map(b => Math.sqrt(Math.max(1, b.total)));
  const sum = weights.reduce((a, v) => a + v, 0) || 1;
  const room = Math.max(0, width - gap * Math.max(0, books.length - 1));
  let x = 0;
  return books.map((b, i) => {
    const w = Math.min(maxW, (weights[i] / sum) * room);
    const out = { x, w, h: height * (0.74 + noise(i + 3) * 0.26), share: b.total > 0 ? Math.max(0, Math.min(1, b.done / b.total)) : 0 };
    x += w + gap;
    return out;
  });
}

// ── Sınavın alanı ──
export type ExamField = 'typing' | 'law' | 'language' | 'health' | 'numeric' | 'driving' | 'security' | 'tech' | 'teaching' | 'general';

/** Sıra önemli: özgül olan önce ("hukuk hakimlik" hukuk, "KPSS hemşirelik" sağlık). Eşleşme yoksa genel: raf. */
const FIELD_RULES: [ExamField, RegExp][] = [
  ['typing', /katip|kâtip|klavye|daktilo|stenograf|f klavye|q klavye|zabıt|mübaşir/],
  ['driving', /ehliyet|sürücü|direksiyon|src\b|driving/],
  ['security', /polis|pmyo|pomem|jandarma|askeri|askerlik|msü|bekçi|güvenlik|subay|astsubay|komiser|military|police/],
  ['law', /hukuk|hmgs|avukat|hâkim|hakim|savcı|noter|iyös|adli|adalet|\blaw\b|\bbar\b/],
  ['health', /tus\b|dus\b|yds tıp|\btıp|sağlık|hemşire|ebe\b|eczacı|diş hek|doktor|stajyer|ydus|bdus|eus\b|sts\b|medical|nursing|usmle/],
  ['language', /ielts|toefl|yds\b|yökdil|ydt\b|pte\b|cefr|goethe|delf|dil sınav|ingilizce|almanca|fransızca|arapça|english|german|french|spanish/],
  ['tech', /yazılım|bilgisayar|bilişim|aws|azure|ccna|comptia|cissp|kubernetes|sertifika|kodlama|programlama|developer|software|ciso|ceh\b/],
  ['teaching', /öabt|oabt|öğretmen|mebsınav|meb-|akademi giriş|pedagoji|formasyon|teacher/],
  ['numeric', /dgs|ales|gmat|gre\b|sat\b|matematik|sayısal|smmm|muhasebe|bankacılık|aktüer|finans|cfa\b|acca|istatistik|math/],
];

export function examFieldOf(name: string): ExamField {
  // Türkçe küçültme "IELTS"i "ıelts" yapar: iki biçim de denenir.
  const n = (name ?? '').toLocaleLowerCase('tr');
  const plain = n.replace(/ı/g, 'i');
  for (const [field, re] of FIELD_RULES) if (re.test(n) || re.test(plain)) return field;
  return 'general';
}

/** Yanan öğe sayısı (tuş, boncuk): iş başladıysa en az bir, hedefe varmadan tamamı değil. */
export function litCount(p: number, total: number): number {
  const v = Math.max(0, Math.min(1, p));
  if (v <= 0) return 0;
  if (v >= 1) return total;
  return Math.max(1, Math.min(total - 1, Math.round(v * total)));
}
