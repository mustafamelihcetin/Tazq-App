/**
 * EKRAN OKUYUCU — adsız kontrol bırakma.
 *
 * ÖLÇÜLEN DURUM: uygulamada 235 dokunulabilir öğenin 218'i zaten görünür bir `<Text>`
 * çocuğu taşıyor, yani VoiceOver/TalkBack onları okuyabiliyordu. Geriye kalan 17'si
 * SESSİZDİ ve iki farklı sorundu:
 *
 *  · 11'i ARKA PLAN / klavye kapatıcıydı. Bunlar kullanıcının seçtiği kontroller değil,
 *    yüzeylerdir. Doğru çözüm ad vermek DEĞİL, erişilebilirlik ağacından çıkarmaktır —
 *    yoksa ekran okuyucuyla gezen kişi ekranın ortasında adsız bir düğmeye takılır.
 *  · 6'sı gerçek İÇERİK satırıydı (görev kartı, alışkanlık satırı, alışkanlık
 *    baloncuğu). Bunlarda durum bilgisi YALNIZ RENKLE söyleniyordu: sol şerit
 *    önceliği, üstü çizili başlık tamamlanmayı, rozet seriyi. Renk ekran okuyucuya
 *    hiçbir şey söylemez — kör bir kullanıcı için tüm satırlar birbirinin aynıydı.
 *
 * Bu test, "sessiz kontrol" sayısının yeniden artmamasını sağlar.
 */
import fs from 'fs';
import path from 'path';
import { describeTask, describeHabit } from '@/shared/utils/a11y';

const ROOT = path.resolve(__dirname, '..');
const SKIP = ['node_modules', '.expo', 'android', 'ios', 'dist', '.git', '__tests__', '__mocks__'];

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.includes(e.name)) return [];
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return walk(rel);
    return /\.tsx$/.test(e.name) ? [rel] : [];
  });
}

const FILES = ['app', 'shared', 'features'].flatMap(walk);
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const OPENERS = /<(TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|Touchable|Pressable)\b/g;

/** Açılış etiketinin tamamını okur; `>` süslü parantez içindeyse etiketi bitirmez. */
function readTag(src: string, from: number): string {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return src.slice(from, i + 1);
  }
  return src.slice(from, from + 2000);
}

/** Öğenin kendi çocukları bir ad sağlıyor mu? */
function childrenHaveText(src: string, tagEnd: number): boolean {
  const slice = src.slice(tagEnd, tagEnd + 900);
  const untilClose = slice.split(/<\/(TouchableOpacity|Touchable|Pressable|TouchableHighlight|TouchableWithoutFeedback)>/)[0] ?? '';
  return /<Text[\s>]/.test(untilClose);
}

type Hit = { file: string; line: number };

/**
 * Blok yorumlarini bosluga cevirir — satir sayisi KORUNUR (satir no'lari bozulmasin).
 *
 * NEDEN: bir kuralin NASIL uygulanacagini anlatan yorum cogu zaman ORNEK KODdur:
 *
 *     <Touchable style={styles.headerIconBtn}>   // ornek, gercek kontrol degil
 *
 * Tarayici bunu KOD sanip "adsiz kontrol" olarak sayiyordu; yani kurali aciklamak
 * kurali cignemek oluyordu. Testi susturmanin yolu yorum YAZMAMAK haline geliyordu,
 * ki bu tam ters bir tesvik. Ayni tuzak palet testinde de yasanmisti (bkz. oradaki not).
 */
function stripBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function silentControls(): Hit[] {
  const out: Hit[] = [];
  for (const f of FILES) {
    const src = stripBlockComments(read(f));
    for (const m of src.matchAll(OPENERS)) {
      const tag = readTag(src, m.index!);

      // Adı var → sorun yok
      if (/accessibilityLabel/.test(tag)) continue;
      // Ağacın DIŞINDA → bilinçli olarak kontrol değil (arka plan, jest, süs)
      if (/accessible=\{false\}/.test(tag)) continue;
      if (/importantForAccessibility="no/.test(tag)) continue;
      // Çocuklarında görünür metin var → okunuyor
      if (childrenHaveText(src, m.index! + tag.length)) continue;

      out.push({ file: f, line: src.slice(0, m.index!).split('\n').length });
    }
  }
  return out;
}

describe('adsız kontrol kalmadı', () => {
  /**
   * BentoCard bilinçli olarak etiketsiz: etiketi çocuk <Text>lerden türetiyor.
   * Elle ad vermek kartın gerçek içeriğini ezer ve ekran okuyucuyu YANLIŞ bilgilendirir
   * — bu bir eksiklik değil, doğru karar (bkz. dosyadaki not).
   */
  const ALLOWED = ['shared/components/BentoCard.tsx'];

  it('ekran okuyucunun adlandıramadığı dokunulabilir öğe yok', () => {
    const hits = silentControls()
      .filter(h => !ALLOWED.includes(h.file))
      .map(h => `${h.file}:${h.line}`);
    expect(hits).toEqual([]);
  });

  it('tarama gerçekten yürüyor — liste boşa düşmesin', () => {
    // Yürüyüş bozulursa test sessizce "0 ihlal" der ve hiçbir şeyi korumaz.
    expect(FILES.length).toBeGreaterThan(80);
    expect(FILES).toContain('app/tasks.tsx');
    expect(FILES).toContain('features/habits/components/HabitBubble.tsx');
  });

  it('tarama YAKALIYOR — adsız bir örnek geçmemeli', () => {
    const sample = '<Touchable onPress={x}><View /></Touchable>';
    const tag = readTag(sample, 0);
    expect(/accessibilityLabel/.test(tag)).toBe(false);
    expect(childrenHaveText(sample, tag.length)).toBe(false);
  });
});

describe('durum RENKTEN başka bir şeyle de söyleniyor', () => {
  /**
   * Bu satırlarda durum YALNIZ renkle söyleniyordu: sol şerit önceliği, üstü çizili
   * başlık tamamlanmayı, rozet seriyi. Renk ekran okuyucuya hiçbir şey söylemez.
   * Metinler tek sözlükte (shared/utils/a11y.ts) — aynı durumu üç dosyada üç farklı
   * cümleyle anlatmak, ekran okuyucu kullananlar için tutarsız konuşmak demekti.
   */
  it('görev satırı öncelik ve tamamlanmayı KELİMEYLE söyler', () => {
    expect(describeTask({ priority: 'High', isCompleted: false }, 'Rapor yaz', 'tr'))
      .toBe('Rapor yaz, yüksek öncelikli, tamamlanmadı');
    expect(describeTask({ priority: 'Low', isCompleted: true }, 'Write report', 'en'))
      .toBe('Write report, low priority, completed');
  });

  it('bilinmeyen öncelik ORTA sayılır — etiket boş kalmaz', () => {
    expect(describeTask({ priority: null, isCompleted: false }, 'X', 'tr')).toContain('orta öncelikli');
  });

  it('alışkanlık satırı durumu ve seriyi KELİMEYLE söyler', () => {
    expect(describeHabit({ doneToday: true, streak: 5 }, 'Su iç', 'tr'))
      .toBe('Su iç, bugün tamamlandı, 5 günlük seri');
    expect(describeHabit({ doneToday: false, streak: 0 }, 'Read', 'en'))
      .toBe('Read, not completed today');
  });

  it('atlanan gün "tamamlandı" diye okunmaz', () => {
    expect(describeHabit({ doneToday: false, skipped: true, streak: 3 }, 'Spor', 'tr'))
      .toBe('Spor, bugün atlandı, 3 günlük seri');
  });

  it('sıfır seri hiç söylenmez — "0 günlük seri" bilgi değil gürültü', () => {
    expect(describeHabit({ doneToday: true, streak: 0 }, 'Su', 'tr')).toBe('Su, bugün tamamlandı');
  });

  it('satırlar sözlüğü KULLANIYOR — kendi kopyalarını tutmuyor', () => {
    for (const f of ['app/tasks.tsx', 'app/cockpit.tsx', 'features/habits/components/HabitBubble.tsx']) {
      expect(read(f)).toContain("from '@/shared/utils/a11y'");
    }
    expect(read('app/tasks.tsx')).toContain('accessibilityLabel={taskA11yLabel}');
    expect(read('app/cockpit.tsx')).toContain('accessibilityLabel={describeHabit(');
    expect(read('features/habits/components/HabitBubble.tsx')).toContain('accessibilityLabel={describeHabit(');
  });

  it('durum makine tarafından da okunabilir (accessibilityState)', () => {
    expect(read('app/tasks.tsx')).toContain('accessibilityState={{ checked: !!task.isCompleted');
    expect(read('app/cockpit.tsx')).toContain('accessibilityState={{ checked: doneToday');
    expect(read('features/habits/components/HabitBubble.tsx')).toContain('accessibilityState={{ checked: !!isCompleted }}');
  });

  it('üç satırın üçü de ne yapacağını söyler (hint)', () => {
    expect(read('app/tasks.tsx')).toContain('rowHint(language)');
    expect(read('app/cockpit.tsx')).toContain('rowHint(language)');
    expect(read('features/habits/components/HabitBubble.tsx')).toContain('accessibilityHint');
  });

  it('baloncuk TAM adı okur — kırpılmışı değil', () => {
    const src = read('features/habits/components/HabitBubble.tsx');
    expect(src).toContain('const a11yLabel = item.title ?? item.name');
    expect(src).not.toContain('accessibilityLabel={compactHabitLabel');
  });
});

describe('arka planlar ağacın dışında', () => {
  /*
    Bu bölüm ARKA PLANLARIN erişilebilirlik ağacından çıkarıldığını doğrular.

    Yukarıdaki `silentControls()` taraması zaten "adsız kontrol kalmadı" diyor; burası
    ONUN NEDEN geçtiğini sabitliyor: geçme sebebi "arka plana ad verdik" değil,
    "arka planı ağaçtan çıkardık" olmalı. Ad vermek yanlış çözüm olurdu — kullanıcının
    seçmediği bir yüzeye isim takmak, ekran okuyucu gezintisine bir durak daha ekler.
  */
  const BACKDROPS: [string, string][] = [
    ['app/tasks.tsx', 'sıralama menüsü'],
    ['features/tasks/components/TaskFormModal.tsx', 'form sayfası'],
    ['features/modes/components/TurkishModeBanner.tsx', 'mod sayfası'],
    ['app/index.tsx', 'komut paleti'],
    ['shared/components/CustomAlert.tsx', 'uyarı katmanı'],
    ['app/achievements.tsx', 'rozet detayı'],
    ['features/user/components/CelebrationOverlay.tsx', 'kutlama katmanı'],
  ];

  it.each(BACKDROPS)('%s arka planı ağacın dışında (%s)', (file) => {
    expect(read(file)).toContain('accessible={false}');
  });

  it('tüm ekranı saran klavye kapatıcılar İÇERİĞİ susturmaz', () => {
    // `no-hide-descendants` bu sarmalayıcılarda TÜM ekranı ekran okuyucudan silerdi.
    for (const f of ['app/login.tsx', 'app/register.tsx', 'app/verify-email.tsx']) {
      const src = read(f);
      const marker = '<TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>';
      expect(src).toContain(marker);
      expect(readTag(src, src.indexOf(marker))).not.toContain('no-hide-descendants');
    }
  });

  it('çocuksuz arka planlar torunlarını da gizler', () => {
    // Çocuğu olmayan tam ekran katmanlarda `no-hide-descendants` güvenli ve daha net.
    expect(read('features/tasks/components/TaskFormModal.tsx')).toContain('importantForAccessibility="no-hide-descendants"');
    expect(read('features/modes/components/TurkishModeBanner.tsx')).toContain('importantForAccessibility="no-hide-descendants"');
  });
});
