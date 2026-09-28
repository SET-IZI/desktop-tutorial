import { resolveLocale } from '@/i18n/config';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('i18n', () => {
  it('priorise le cookie, puis Accept-Language, puis FR', () => {
    expect(resolveLocale('en', 'fr-FR')).toBe('en');
    expect(resolveLocale(undefined, 'en-US,en;q=0.9')).toBe('en');
    expect(resolveLocale(undefined, 'de-DE,de;q=0.9')).toBe('fr');
    expect(resolveLocale('xx', null)).toBe('fr');
  });

  it('FR et EN ont exactement les mêmes clés', () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });
});
