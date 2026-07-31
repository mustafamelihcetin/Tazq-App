/**
 * TOPARLANMA SİNYALİ — uykudan türeyen, planın yükünü ayarlayan tek ölçü.
 *
 * ── NEDEN VAR ───────────────────────────────────────────────────────────────────
 * Plan motoru bugüne kadar yalnızca UYUMU biliyordu: "dün görevlerini yaptı mı?".
 * Bilmediği şey ise daha önemliydi: "bugün yapabilir mi?". Üst üste kötü uyumuş bir
 * kullanıcıya dünküyle aynı yükü vermek, planı gerçeğe değil takvime bağlı tutar —
 * ve tutturamadığı her gün onu plandan biraz daha uzaklaştırır.
 *
 * ── SINIR: BU BİR SAĞLIK TAVSİYESİ DEĞİL ────────────────────────────────────────
 * Burada "az uyudun, dinlen" demiyoruz. Uygulamanın işi reçete yazmak değil; işi KENDİ
 * İSTEDİĞİNİ ayarlamak. Yani sinyal kullanıcıya değil, motora gidiyor: o gün bir görev
 * daha az üretiliyor, hacim artırma önerisi ertelenıyor. Kullanıcı hiçbir uyarı görmez,
 * yalnız günü biraz daha taşınabilir olur.
 *
 * Bu ayrım hem doğru hem gerekli: sağlık iddiası uygulama mağazalarında ayrı bir
 * inceleme kategorisi ve tutmadığında sorumluluğu da üstlenmiş oluruz.
 *
 * ── NEDEN YALNIZCA "DÜŞÜK" VAR, "YÜKSEK" YOK ────────────────────────────────────
 * İyi uyudu diye yük ARTIRMIYORUZ. Motorun mevcut sözleşmesi de bu (bkz.
 * adaptiveTaskCount: "yalnızca HAFİFLETİR, asla artırmaz"). Sebebi basit: az yük
 * verip yanılmanın bedeli bir gün eksik çalışmak; fazla yük verip yanılmanın bedeli
 * kullanıcının planı tümden bırakması. İki hata aynı ağırlıkta değil.
 */

export type RecoveryState = 'unknown' | 'low' | 'normal';

/** Kaç günlük gerçek veri olmadan hüküm verilmez. */
const MIN_DAYS = 3;

/**
 * Hedefin bu kadar altı "borç" sayılır (dakika).
 *
 * 60 dakika bilinçli olarak GENİŞ: 20-30 dakikalık sapma ölçüm gürültüsüdür (saat
 * bileğinden çıkar, telefon yatakta kalır). Dar bir eşik, planı her küçük dalgada
 * oynatır ve kullanıcı sebebini anlayamadığı bir tutarsızlık görür.
 */
const DEBT_MINUTES = 60;

/**
 * Son günlerin uykusundan toparlanma durumunu çıkarır.
 *
 * @param minutesByDay `SleepHealth.getSleepMinutesByDay` çıktısı — 'YYYY-MM-DD' → dakika.
 * @param goalHours    Kullanıcının KENDİ hedefi (sabit 8 saat değil): kimi 6 saatle
 *                     dinlenir, kimi 9 ister. Ölçüt kullanıcının kendi eşiği olmalı.
 * @param now          Test edilebilirlik için; varsayılan şimdi.
 */
export function recoveryFromSleep(
  minutesByDay: Record<string, number>,
  goalHours: number,
  now: Date = new Date(),
): RecoveryState {
  if (!minutesByDay || !Number.isFinite(goalHours) || goalHours <= 0) return 'unknown';

  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  /*
    SON GÜNLER, TAKVİM GÜNLERİ DEĞİL.

    Veri olan son N gün alınıyor — aradaki boş günler atlanıyor. Boşluğu "sıfır uyku"
    saymak en sık yapılan hata olurdu: kullanıcı saatini şarj ettiği gece uyumadı
    sayılır, plan da sebepsiz hafifler. Veri yoksa bilgi yoktur, sıfır değil.
  */
  const recent: number[] = [];
  for (let i = 0; i < 14 && recent.length < MIN_DAYS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const mins = minutesByDay[key(d)];
    if (typeof mins === 'number' && mins > 0) recent.push(mins);
  }

  if (recent.length < MIN_DAYS) return 'unknown';

  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  return avg < goalHours * 60 - DEBT_MINUTES ? 'low' : 'normal';
}
