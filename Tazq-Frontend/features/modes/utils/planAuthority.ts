/*
  MODLARIN YETKİLİ KOPYASI HANGİSİ (2026-11-05, kök neden). Eski kural: "yerelde plan KIRINTISI (eski ad, eski kimlik)
  varsa bulut plan alanlarını ezmesin". Zincir: kırıntı → buluttaki modlar atlanır → modlar kapalı görünür → temizlik
  (usePlanAdaptations) mod alışkanlıklarını siler → boş hâl buluta yazılır. Hesapta modlar ve alışkanlıklar böyle silindi.

  Yeni kural zamana dayanır. `seasonalAt` yalnız KULLANICININ mod kararında damgalanır (bkz. setSeasonalPref):
  otomatik temizlik ve sıfırlama damga atmaz, yani makine hiçbir zaman "daha yeni" sayılmaz.
*/
export const MODE_FLAGS = ['ramazan', 'examMode', 'tezMode', 'mulakatMode', 'sporMode', 'tasarrufMode', 'birakmaMode'] as const;

export const hasActiveMode = (seasonal: unknown): boolean => {
  const s = (seasonal ?? {}) as Record<string, unknown>;
  return MODE_FLAGS.some(k => s[k] === true);
};

/** Mod kararı mı: bayrak değişimi ya da dolu bir ad/tarih. Boşaltan yazımlar (temizlik) karar sayılmaz. */
export const isModeDecision = (key: string, value: unknown): boolean =>
  (MODE_FLAGS as readonly string[]).includes(key) || !!value;

export function localPlansWin(i: { localAt: number; cloudAt: number; localActive: boolean }): boolean {
  if (i.localAt > 0) return i.localAt >= i.cloudAt;
  // Damgasız eski kurulum + damgasız bulut: yalnız GERÇEKTEN açık mod varsa yerel korunur (bayat buluta karşı).
  return i.cloudAt === 0 && i.localActive;
}

/** Bulutta açık mod varken, kullanıcı kararı olmadan "hepsi kapalı" gönderilemez. */
export function wouldWipeModes(i: { localSeasonal: unknown; cloudSeasonal: unknown; localAt: number; cloudAt: number }): boolean {
  return hasActiveMode(i.cloudSeasonal) && !hasActiveMode(i.localSeasonal) && i.localAt <= i.cloudAt;
}
