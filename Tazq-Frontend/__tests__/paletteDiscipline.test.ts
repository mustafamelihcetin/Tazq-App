import fs from 'fs';
import path from 'path';

/**
 * Palet disiplini bekçisi — sabit renk borcunun BÜYÜMESİNİ engeller.
 *
 * Neden bir "borç tavanı" testi: uygulamada 870 sabit hex vardı ve paleti değiştirmek
 * hiçbir şeyi değiştirmiyordu, çünkü ekranlar palete bakmıyordu. Sistematik olanlar
 * toplandı (mod kategorileri 270+26 → CategoryColors, mod vurguları → ModeAccents,
 * dashboard → tema token'ları). Kalanlar bağlama bağlı: aynı hex bir yerde "başarı"
 * (semantik → theme.success), başka yerde kullanıcının seçtiği avatar rengi
 * (kategorik → CategoryColors). Bunları regex'le çevirmek yanlış olur; her biri
 * bakmayı gerektirir.
 *
 * Bu yüzden test "0" dayatmıyor — mevcut borcu ÇİVİLİYOR. Yeni sabit renk eklenirse
 * test kırılır ve kişi ya palete bağlar ya da bilinçli olarak tavanı düşürerek
 * (asla yükselterek değil) istisnayı belgeler.
 *
 * Hedef: bu sayı her turda küçülsün. Yükselmesi bir regresyondur.
 */

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = ['node_modules', '.expo', 'android', 'ios', '.git', '__tests__', '__mocks__', 'dist'];

// Palet token'ı olmayan, meşru kullanımlar:
//  - saf beyaz/siyah: renkli buton üzerindeki yazı, gölge rengi
//  - rgba(): saydam katman, palet token'i değil
const ALLOWED = new Set(['#FFFFFF', '#FFF', '#000000', '#000']);

// Paletin kendi tanım dosyası doğal olarak hex içerir.
const EXEMPT_FILES = new Set(['shared/constants/Colors.ts']);

/**
 * Dosya başına izin verilen sabit renk TAVANI.
 * Bu liste yalnızca KÜÇÜLMELİ. Bir dosyayı palete bağladıkça satırını düşür/sil.
 */
const CEILING: Record<string, number> = {
  'app/admin.tsx': 100,  // admin paneli — son kullanıcı görmüyor
  // 53 → 43: SettingsCard ve üç modal zemini palete bağlandı. Hepsi aynı kazaydı —
  // '#1C1C22' sabiti. Dashboard kartları theme.surfaceContainerHigh (#222228) kullanırken
  // profil kendi tonunu yazmıştı: aynı uygulamada iki kart rengi. Kalanlar başarım
  // rozetleri ve kullanıcının seçtiği çerçeve renkleri (kategorik — bakılması gerekiyor).
  'app/profile.tsx': 43,
  'shared/components/RocketFeedback.tsx': 49,  // kendi durum renk dili (cyan/mor/turuncu/kırmızı)
  'app/promo.tsx': 42,  // pazarlama sayfası — kendi görsel dili
  'app/modlar.tsx': 25,
  'app/cockpit.tsx': 23,
  'app/onboarding.tsx': 23,
  'features/modes/components/TurkishModeBanner.tsx': 23,
  'shared/components/ProfileSetupModal.tsx': 22,  // kullanıcının seçtiği avatar renkleri
  'features/modes/components/modes/SporCard.tsx': 21,
  'app/focus.tsx': 18,  // derin odak — Skia shader, kendi görsel dili
  'app/mod-ozet.tsx': 18,
  'shared/utils/achievementIcons.tsx': 15,  // her başarımın kimlik rengi
  'features/modes/components/modes/RamazanCard.tsx': 12,
  'shared/components/CelebrationOverlay.tsx': 12,
  'shared/components/ConfettiOverlay.tsx': 12,
  'shared/components/TourFeaturePreview.tsx': 12,
  'app/tasks.tsx': 10,
  'shared/components/StatusHubModal.tsx': 10,
  'shared/components/WeightEntryModal.tsx': 8,
  'app/report.tsx': 7,
  'features/modes/utils/modeHelpers.ts': 7,
  'shared/components/QuickDraftModal.tsx': 7,
  'features/modes/components/modes/ExamCard.tsx': 6,
  'shared/components/TaskFormModal.tsx': 6,
  'features/modes/components/modes/MulakatCard.tsx': 5,
  'features/modes/components/modes/TezCard.tsx': 5,
  'shared/components/SupportModal.tsx': 5,
  'app/login.tsx': 4,
  'app/register.tsx': 4,
  'features/focus/components/DynamicIsland.tsx': 4,
  'shared/components/ErrorBoundary.tsx': 4,
  'shared/components/HabitBubble.tsx': 4,
  'shared/components/BirakmaCard.tsx': 3,
  'shared/components/SwipeableHabitItem.tsx': 3,
  'shared/components/TasarrufCard.tsx': 3,
  'shared/components/Toast.tsx': 3,
  'features/user/components/ReviewPromptModal.tsx': 2,
  'shared/components/AnimatedSplash.tsx': 2,
  'shared/components/CustomAlert.tsx': 2,
  'shared/utils/calendarSync.ts': 2,
  'shared/utils/lifeModePlans.ts': 2,
  'features/focus/components/FocusIsland.tsx': 1,
  'features/habits/store/useHabitStore.ts': 1,
  'shared/components/GlassCard.tsx': 1,
  'shared/components/MomentumPulse.tsx': 1,
  // MyDayTaskRow: temizlendi. Tek sabit rengi #10B981 idi ve iki temada da aynıydı —
  // yani koyu temada yanlıştı. theme.success'e bağlandı (açık #047857 / koyu #34D399).
  'shared/components/PeekMenu.tsx': 1,
  'shared/components/SwipeableItem.tsx': 1,
  'shared/utils/calendarService.ts': 1,
};

const HEX = /#[0-9A-Fa-f]{6}\b/g;

/**
 * Blok yorumlarını boşluğa çevirir — satır sayısı KORUNUR (satır no'ları bozulmasın).
 *
 * Neden: bu tarayıcılar satır satır çalışıyor ve yalnızca `//` ile başlayan satırları
 * atlıyordu. Ama bir kuralın NEDENİNİ anlatan yorum çoğu zaman JSX blok yorumudur:
 *
 *     {\* Renk: "#fff" sabit yazılıydı... koyu temada primary #0A84FF *\}
 *
 * Bu satır `//` ile başlamıyor, dolayısıyla test onu KOD sanıp içindeki hex'i ihlal
 * olarak sayıyordu. Yani kuralı açıklamak kuralı çiğnemek sayılıyordu — testi
 * susturmak için yorum yazmaktan kaçınmak gerekiyordu, ki bu tam tersi bir teşvik.
 *
 * Aynı tuzağa üç kez düştüm (BentoCard gölgesi, ScreenHeader paddingVertical, burası).
 */
function stripBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

function countHardcoded(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of walk(ROOT)) {
    const key = path.relative(ROOT, file).split(path.sep).join('/');
    if (EXEMPT_FILES.has(key)) continue;
    const src = stripBlockComments(fs.readFileSync(file, 'utf8'));
    let n = 0;
    for (const line of src.split('\n')) {
      const s = line.trim();
      if (s.startsWith('//') || s.startsWith('*') || s.startsWith('/*')) continue;
      for (const m of line.match(HEX) ?? []) {
        if (!ALLOWED.has(m.toUpperCase())) n++;
      }
    }
    if (n) counts[key] = n;
  }
  return counts;
}

describe('palet disiplini', () => {
  const counts = countHardcoded();

  it('hiçbir dosya tavanını aşmamalı', () => {
    const over = Object.entries(counts)
      .filter(([f, n]) => n > (CEILING[f] ?? 0))
      .map(([f, n]) => `${f}: ${n} (tavan ${CEILING[f] ?? 0})`);

    // Yeni sabit renk eklendiyse: palete bağla (Colors.ts / CategoryColors / ModeAccents).
    // Gerçekten gerekliyse tavanı bilinçli yükselt ve NEDENİNİ yaz.
    expect(over).toEqual([]);
  });

  it('tavan listesi bayatlamamalı — düşen dosyalar listeden çıkmalı', () => {
    // Bir dosya artık sabit renk içermiyorsa tavanı silinmeli; yoksa liste yalan söyler
    // ve "temizlendi" bilgisi kaybolur.
    const stale = Object.keys(CEILING).filter((f) => !counts[f]);
    expect(stale).toEqual([]);
  });

  it('mod kategori renkleri palete bağlı kalmalı', () => {
    // turkishModes 270, planExtractor 26 sabit renk içeriyordu — hepsi CategoryColors'a
    // taşındı. Geri dönerse burası kırılır.
    for (const f of ['features/modes/utils/turkishModes.ts', 'shared/utils/planExtractor.ts']) {
      expect(counts[f] ?? 0).toBe(0);
    }
  });

  it('dashboard tamamen palete bağlı kalmalı', () => {
    // Kullanıcının en çok gördüğü ekran; 15 sabit rengi vardı.
    expect(counts['app/index.tsx'] ?? 0).toBe(0);
  });
});

describe('alfa ekleme', () => {
  /**
   * `theme.primary + '30'` MEŞRU: hex renge alfa ekler (#RRGGBB → #RRGGBBAA).
   * `theme.outline + '30'` SESSİZ HİÇLİK: outline zaten rgba(), ve RN'in ayrıştırıcısı
   * `rgba(...)` önekini eşleştirip sondaki `30`'u yok sayar. Çökmez, uyarmaz —
   * sadece hiçbir şey yapmaz.
   *
   * 11 dosyada 27 kez yazılmıştı: geliştiriciler kenar opaklığını ayarladıklarını
   * sandı, hepsi token'ın taban değerinde çizildi. tsc göremez (string + string).
   *
   * rgba token listesi Colors.ts'ten TÜRETİLİR: palete yeni bir rgba token eklenirse
   * bu test onu otomatik kapsar, elle güncelleme gerektirmez.
   */
  const paletteSrc = fs.readFileSync(path.join(ROOT, 'shared/constants/Colors.ts'), 'utf8');
  const rgbaTokens = [
    ...new Set(
      [...paletteSrc.matchAll(/^ {2}([a-zA-Z]+):\s*(Platform\.OS[^,]*?|'[^']*')(?=,)/gm)]
        .filter((m) => /rgba\(/.test(m[2]))
        .map((m) => m[1]),
    ),
  ];

  it('rgba token listesi boş olmamalı — regex paleti hâlâ okuyabilmeli', () => {
    // Bu test diğerinin bekçisi: Colors.ts'in biçimi değişip regex hiçbir şey
    // bulamazsa alttaki test sessizce "her şey yolunda" der. Sessiz geçiş = değersiz test.
    expect(rgbaTokens).toContain('outline');
    expect(rgbaTokens.length).toBeGreaterThanOrEqual(5);
  });

  it('rgba token’a alfa eklenmemeli — etkisi yok', () => {
    const pattern = new RegExp(`\\btheme\\.(${rgbaTokens.join('|')})\\s*\\+\\s*['"\`]`);
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const src = fs.readFileSync(file, 'utf8');
      src.split('\n').forEach((line, i) => {
        const s = line.trim();
        if (s.startsWith('//') || s.startsWith('*')) return;
        if (pattern.test(line)) hits.push(`${path.relative(ROOT, file).split(path.sep).join('/')}:${i + 1}`);
      });
    }
    // Şeffaflık gerekiyorsa: palete uygun opaklıkta yeni bir token ekle.
    expect(hits).toEqual([]);
  });
});
