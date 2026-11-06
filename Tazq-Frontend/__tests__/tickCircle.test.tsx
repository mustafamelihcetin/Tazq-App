import React from 'react';
import { render } from '@testing-library/react-native';
import { TickCircle } from '@/shared/components/TickCircle';

const props = { size: 22, color: '#0a0', ringColor: '#888', tickColor: '#fff' };

/** iOS'ta cihazda: yapılmamış görevin dairesinde nokta görünüyordu. İşaretsizken tik hiç çizilmez. */
describe('tik dairesi', () => {
  it('işaretsizken çizgi yok', () => {
    const ui = render(<TickCircle checked={false} {...props} />);
    expect(ui.UNSAFE_queryAllByType(require('react-native-svg').Path)).toHaveLength(0);
  });
  it('işaretliyken çizgi var', () => {
    const ui = render(<TickCircle checked {...props} />);
    expect(JSON.stringify(ui.toJSON())).toContain('RNSVG');
  });
});
