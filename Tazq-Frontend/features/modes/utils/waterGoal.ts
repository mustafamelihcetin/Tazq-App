/*
  SU GÖREVİ (2026-11-05, kullanıcı: "su görevi varsa minimal bir su içme animasyonu; user ile bağ kuralım"). Saf: ekran bilmez, test edilir.
  "2 litre su" tek dokunuşla bitmez, gün içinde bardak bardak ilerler. Bir bardak 250 ml.
  Görevde sudan başka bir şey de isteniyorsa ("ve şekerli içecekten kaçın", "7-8 saat uyku") bardak dolunca görev kendiliğinden işaretlenmez: kalan kısmı kullanıcı adına söyleyemeyiz.
*/
export interface WaterGoal { glasses: number; pure: boolean }

const GLASSES_PER_LITRE = 4;
const LITRES = /(\d+(?:[.,]\d+)?)\s*\+?\s*(?:litre|liter|lt\b|l\b)/iu;
const IS_WATER = /(?:^|[^\p{L}])(?:su|suy[au]|suyunu|water)(?=$|[^\p{L}])/iu;
const ONE_GLASS = /(?:bir bardak su|a glass of water)/iu;
const OTHER_ASK = /kaçın|uyku|uyu|sugary|sleep|eline|hold something|rota|route/iu;
const NOT_DRINKING = /değiştir|swap|planla|schedule|hidrasyon|hydration/iu;

export function waterGoalOf(title: string): WaterGoal | null {
  if (NOT_DRINKING.test(title)) return null;
  if (ONE_GLASS.test(title)) return { glasses: 1, pure: !OTHER_ASK.test(title) };
  const m = LITRES.exec(title);
  if (!m || !IS_WATER.test(title)) return null;
  const litres = parseFloat(m[1].replace(',', '.'));
  if (!litres) return null;
  return { glasses: Math.round(litres * GLASSES_PER_LITRE), pure: !OTHER_ASK.test(title) };
}

/** Görev iki dilli yük taşıyorsa önce Türkçe başlığa bakılır; kalıplar iki dili de bilir. */
export const waterGoalOfTask = (t: { title: string; description?: string | null }): WaterGoal | null => {
  if (t.description?.startsWith('{"tr":')) {
    try { return waterGoalOf(JSON.parse(t.description).tr ?? t.title); } catch { /* düz başlığa düş */ }
  }
  return waterGoalOf(t.title);
};
