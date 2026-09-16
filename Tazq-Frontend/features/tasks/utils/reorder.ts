/**
 * ELLE SIRALAMA — süzgeç açıkken de doğru çalışan yer değiştirme.
 *
 * ── ÖLÇÜLEN SORUN ─────────────────────────────────────────────────────────────
 * Yukarı/aşağı taşıma, sırayı GÖRÜNEN listeden üretiyordu: `[...filteredTasks]`
 * üzerinde iki öğe takas edilip o listenin kimlikleri mağazaya veriliyordu.
 *
 * Mağaza ise verilen kimliklere 0..n sırası yazıp GERİ KALANLARI eski sıralarıyla
 * bırakıyor (bkz. useTaskStore.reorderTasks). Yani bir süzgeç açıkken (öncelik, arama,
 * "tamamlananları gizle") iki görevi taşımak, görünmeyen bütün görevlerin sırasıyla
 * çakışan yeni bir numaralandırma üretiyordu. Kullanıcı süzgeci kaldırdığında listesi
 * kendiliğinden karışmış oluyordu — ne yaptığıyla bağlantısı kurulamayan bir değişiklik.
 *
 * Çözüm: takas TAM listede yapılır, yalnız kullanıcının GÖRDÜĞÜ iki komşu yer değiştirir.
 * Aradaki gizli görevler yerinde kalır; kimsenin sırası kendiliğinden bozulmaz.
 */

/**
 * `aId` ile `bId`yi tam sıralı listede yer değiştirir ve YENİ tam listeyi döndürür.
 *
 * Kimliklerden biri listede yoksa liste olduğu gibi döner — eksik veriyle sıralamayı
 * yeniden yazmak, düzeltmeye çalıştığımız karışıklığın aynısını üretir.
 */
export function swapInFullOrder(allIds: number[], aId: number, bId: number): number[] {
  const a = allIds.indexOf(aId);
  const b = allIds.indexOf(bId);
  if (a < 0 || b < 0 || a === b) return allIds;
  const next = [...allIds];
  next[a] = bId;
  next[b] = aId;
  return next;
}

/**
 * Görünen listedeki bir hamleyi tam sıraya çevirir.
 *
 * @param allIds        Mağazadaki TÜM görevlerin güncel sırası.
 * @param visibleIds    Ekranda görünen (süzülmüş) sıradaki kimlikler.
 * @param index         Taşınan öğenin GÖRÜNEN listedeki sırası.
 * @param direction     Yukarı ya da aşağı.
 * @returns Yeni tam sıra; hamle geçersizse `null` (çağıran hiçbir şey yazmamalı).
 */
export function moveWithinVisible(
  allIds: number[],
  visibleIds: number[],
  index: number,
  direction: 'up' | 'down',
): number[] | null {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= visibleIds.length) return null;
  if (target < 0 || target >= visibleIds.length) return null;

  const next = swapInFullOrder(allIds, visibleIds[index], visibleIds[target]);
  // Hiçbir şey değişmediyse yazma: gereksiz kalıcılaştırma ve sunucu isteği doğurur.
  return next === allIds ? null : next;
}
