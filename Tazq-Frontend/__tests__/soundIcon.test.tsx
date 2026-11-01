import React from 'react';
import { render } from '@testing-library/react-native';
import { SoundIcon, type SoundKind } from '@/features/focus/components/SoundIcon';

/*
  ÇALAN SESİN SİMGESİ (2026-11-01, kullanıcı: "hangi ses aktifse onun ikonu hareketlenmeli, statik çubuklar
  değil"). Her tür kendi çizimiyle ve hareketiyle kurulur; hiçbiri boş ya da hatalı çizilmemeli.
*/
const KINDS: SoundKind[] = ['rain', 'wind', 'cafe', 'forest', 'ocean', 'fireplace', 'relaxing', 'binaural', 'brown'];

describe('SoundIcon', () => {
  it.each(KINDS)('%s çizilir', (kind) => {
    const v = render(<SoundIcon kind={kind} size={14} color="#0B6BCB" />);
    expect(v.toJSON()).not.toBeNull();
  });

  it('hareketli parçalı türler ayrı katmanlarla kurulur (buhar, damla, dalga, rüzgar çizgisi)', () => {
    for (const kind of ['cafe', 'rain', 'ocean', 'wind'] as SoundKind[]) {
      const json = JSON.stringify(render(<SoundIcon kind={kind} size={14} color="#000" />).toJSON());
      // Gövde + üç hareketli parça (okyanus/rüzgarda yalnız üç parça).
      const layers = (json.match(/"type":"RNSVGSvgView"/g) ?? []).length;
      expect(layers).toBeGreaterThanOrEqual(3);
    }
  });
});
