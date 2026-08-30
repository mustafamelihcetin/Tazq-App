/**
 * SPOR HEDEF ÇİPLERİ — ikon KİMLİKTEN türer, görünen metinden değil.
 *
 * ÖLÇÜLEN SORUN: çip ikonu `getEmojiFromLabel(g.label)` ile üretiliyordu, yani
 * etiketin BAŞINDAKİ emojiden. Etiketler emojisiz hâle gelince ("⚖️ Kilo Yönetimi"
 * → "Kilo Yönetimi") o fonksiyon boş string dönmeye başladı; `renderModeEmojiIcon('')`
 * de switch'in sonuna düşüp boş bir `<Text>` çizdi. Sonuç: beş çipin de ikonu yok,
 * yanında da ikondan kalan boşluk.
 *
 * Asıl hata emojiyi silmek değil, ikonu METİNDEN türetmekti: görünen metin bir kimlik
 * değil sunumdur — değişince ona bağlı her şey sessizce bozulur.
 */
import fs from 'fs';
import path from 'path';
import { stripLeadingEmoji } from '@/shared/utils/emoji';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

const SPOR = stripComments(read('features/modes/components/modes/SporCard.tsx'));

describe('çip ikonu', () => {
  it('hedefin KEY alanından türetilir', () => {
    expect(SPOR).toContain('renderModeEmojiIcon(goalEmoji(g.key)');
  });

  it('etiket metninden türetilmez — o fonksiyon tamamen kalktı', () => {
    expect(SPOR).not.toContain('getEmojiFromLabel');
  });

  it('her iki çip listesinde de aynı yol kullanılıyor', () => {
    expect((SPOR.match(/renderModeEmojiIcon\(goalEmoji\(g\.key\)/g) ?? []).length).toBe(2);
  });

  it('goalEmoji beş hedef türünün HEPSİNİ karşılıyor', () => {
    // getSporGoals: maraton | guc | kilo | genel | yaris
    const fn = SPOR.slice(SPOR.indexOf('const goalEmoji'), SPOR.indexOf('const goalEmoji') + 300);
    for (const key of ['kilo', 'maraton', 'yaris', 'genel']) {
      expect(fn).toContain(`'${key}'`);
    }
    // 'guc' varsayılan dala düşer — beşinci tür de ikonsuz kalmaz
    expect(fn).toContain("'💪'");
  });
});

describe('etiketler kaynağında emojisiz üretiliyor', () => {
  it('getSporGoals hiçbir etikete emoji koymuyor', () => {
    const block = SPOR.slice(SPOR.indexOf('function getSporGoals'), SPOR.indexOf('function sporGoalsForSlot'));
    expect(block).not.toMatch(/label: '[\p{Extended_Pictographic}]/u);
  });

  it('taze etikete gereksiz kırpma uygulanmıyor', () => {
    expect(SPOR).not.toContain('stripEmojiPrefix(g.label)');
  });

  it('KAYITLI (eski) hedef adına kırpma hâlâ uygulanıyor', () => {
    // Kullanıcının cihazında "⚖️ Kilo Yönetimi" biçiminde kayıtlar hâlâ olabilir
    expect(SPOR).toContain('stripEmojiPrefix(goal)');
  });
});

describe('stripLeadingEmoji — tek doğru uygulama', () => {
  it('emoji önekini siler', () => {
    expect(stripLeadingEmoji('💪 Güç & Kas')).toBe('Güç & Kas');
    expect(stripLeadingEmoji('⚖️ Kilo Yönetimi')).toBe('Kilo Yönetimi');
    expect(stripLeadingEmoji('🏆 Spor Yarışması')).toBe('Spor Yarışması');
  });

  it('birleşik emojiyi (ZWJ + varyasyon seçici) tam siler', () => {
    expect(stripLeadingEmoji('🏃‍♂️ Maraton')).toBe('Maraton');
  });

  it('RAKAMLA BAŞLAYAN adı BOZMAZ — asıl hata buydu', () => {
    // Eski `\p{Emoji}` sınıfı 0-9, # ve * karakterlerini de kapsıyordu:
    // '5K Koşu Programı' → 'K Koşu Programı'
    expect(stripLeadingEmoji('5K Koşu Programı')).toBe('5K Koşu Programı');
    expect(stripLeadingEmoji('10K hazırlık')).toBe('10K hazırlık');
    expect(stripLeadingEmoji('3 Aylık Plan')).toBe('3 Aylık Plan');
    expect(stripLeadingEmoji('#1 hedef')).toBe('#1 hedef');
  });

  it('emojisiz adı olduğu gibi bırakır', () => {
    expect(stripLeadingEmoji('Genel Form')).toBe('Genel Form');
  });

  it('tamamen emojiden ibaret adı BOŞA çevirmez — veri silinmez', () => {
    expect(stripLeadingEmoji('🏆')).toBe('🏆');
  });

  it('boş/null girdide çökmez', () => {
    expect(stripLeadingEmoji('')).toBe('');
    expect(stripLeadingEmoji(null)).toBe('');
    expect(stripLeadingEmoji(undefined)).toBe('');
  });
});

describe('kural TEK yerde — üç kopya birleşti', () => {
  it('turkishModes kendi regex kopyasını tutmuyor', () => {
    const src = stripComments(read('features/modes/utils/turkishModes.ts'));
    expect(src).not.toContain('\\p{Emoji}');
    expect(src).not.toContain('Extended_Pictographic');
    expect(src).toContain('stripLeadingEmoji');
  });

  it('SporCard kendi liste tabanlı kopyasını tutmuyor', () => {
    expect(SPOR).not.toContain('SPOR_EMOJIS');
    expect(SPOR).toContain('stripLeadingEmoji');
  });
});
