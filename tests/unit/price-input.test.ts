import { formatEuroInput, parseEuroInput } from '@/lib/admin/price-input';

describe('saisie de prix', () => {
  it('accepte virgule, point, espaces et symbole euro', () => {
    expect(parseEuroInput('13,50')).toBe(1350);
    expect(parseEuroInput('13.5')).toBe(1350);
    expect(parseEuroInput(' 13 € ')).toBe(1300);
    expect(parseEuroInput('0,99')).toBe(99);
    expect(parseEuroInput('1 250,00')).toBe(125000);
  });

  it('refuse le vide, les négatifs, trop de décimales ou du texte', () => {
    expect(parseEuroInput('')).toBeNull();
    expect(parseEuroInput('-2')).toBeNull();
    expect(parseEuroInput('1,999')).toBeNull();
    expect(parseEuroInput('douze')).toBeNull();
  });

  it('formate pour le champ', () => {
    expect(formatEuroInput(1350)).toBe('13,50');
    expect(formatEuroInput(0)).toBe('0,00');
  });
});
