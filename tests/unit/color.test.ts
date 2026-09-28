import { contrastRatio, hexToRgb, readableTextOn, toRgbChannels } from '@/lib/color';

describe('color', () => {
  it('parse les formats courts et longs', () => {
    expect(hexToRgb('#0A84FF')).toEqual([10, 132, 255]);
    expect(hexToRgb('fff')).toEqual([255, 255, 255]);
    expect(toRgbChannels('#30D158')).toBe('48 209 88');
  });

  it('rejette une couleur invalide', () => {
    expect(() => hexToRgb('#12')).toThrow();
  });

  it('calcule le contraste WCAG', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    // Le CTA #0071E3 tient AA avec du texte blanc, #0A84FF non.
    expect(contrastRatio('#0071E3', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#0A84FF', '#FFFFFF')).toBeLessThan(4.5);
  });

  it('choisit un texte lisible sur un accent restaurant', () => {
    expect(readableTextOn('#FF9F0A')).toBe('#1D1D1F');
    expect(readableTextOn('#1D1D1F')).toBe('#FFFFFF');
  });

  it('le texte secondaire tient AA sur le fond clair', () => {
    expect(contrastRatio('#636366', '#F5F5F7')).toBeGreaterThanOrEqual(4.5);
  });
});
