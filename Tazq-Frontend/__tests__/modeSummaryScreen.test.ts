import fs from 'fs';
import path from 'path';

/**
 * MODLARIN ÖZETİ — "karmaşık ve çirkin, uygulamayla uyuşmuyor" (2026-09-20).
 *
 * Ölçülen kusurlar: üç ölçüt ham sistem renkleriyle boyanmıştı (`#FF9500`, `#34C759`,
 * koyu temada hiç değişmeyen sabit hex); ekranda 4+N ayrı kenarlıklı kutu duruyordu
 * (üç istatistik kartı, bir "genel durum" kutusu, bir "bugünkü plan" kutusu, N mod
 * satırı); ilerleme ham `<View>` çubuklarıyla elle çiziliyordu; "En yakın hedef"
 * sayı+birimi "84g" gibi bitiştirilmiş kısaltmayla yazıyordu.
 */
const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const SCREEN = read('app/mod-ozet.tsx');

describe('modların özeti — tek kahraman kart + tek liste kabı', () => {
  it('ham sistem rengi yok — semantik tema token\'ları kullanılıyor', () => {
    expect(SCREEN).not.toMatch(/#FF9500|#34C759|'#fff'/i);
    expect(SCREEN).toContain('theme.streak');
    expect(SCREEN).toContain('theme.success');
    expect(SCREEN).toContain('theme.onPrimary');
  });

  it('ilerleme ProgressRail\'den geçer, ham View çubuğu yok', () => {
    expect(SCREEN).toContain('<ProgressRail');
    expect(SCREEN).not.toMatch(/height: 8, borderRadius: R\.xs, width: `\$\{/);
  });

  it('üç ölçüt TEK kartın içinde — ayrı kenarlıklı kutular değil', () => {
    const heroBlock = SCREEN.slice(SCREEN.indexOf('styles.hero'), SCREEN.indexOf('Mod listesi'));
    // Dikey ayırıcı çizgiler var (aralarında), ama her ölçütün KENDİ kenarlığı yok.
    expect(heroBlock).toContain('<Metric');
    expect((heroBlock.match(/borderWidth: B\.thin/g) || []).length).toBe(0);
  });

  it('mod satırları kendi kenarlığını taşımaz — tek liste kabı + hairline ayırıcı', () => {
    const rowFn = SCREEN.slice(SCREEN.indexOf('function ModeRow'), SCREEN.indexOf('export default function'));
    expect(rowFn).toContain('borderTopWidth: isFirst ? 0 : HAIRLINE');
    expect(rowFn).not.toContain('borderColor: c.color');
  });

  it('sayı ile birim ASLA bitiştirilmez ("84g" değil, "84" + ayrı "gün")', () => {
    expect(SCREEN).not.toMatch(/\$\{nearest\.days\}\$\{tr \? 'g' : 'd'\}/);
    expect(SCREEN).toContain('unit={nearest ?');
    expect(SCREEN).toContain('alignItems: \'baseline\'');
  });

  it('kullanılmayan içe aktarmalar temizlendi (useTaskStore/useHabitStore/useActiveTasks yok)', () => {
    expect(SCREEN).not.toMatch(/useTaskStore|useHabitStore|useActiveTasks/);
  });
});
