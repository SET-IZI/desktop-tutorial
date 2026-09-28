// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { decryptSecret, encryptSecret, maskSecret } from '@/lib/crypto';

const key = randomBytes(32).toString('base64');

describe('crypto', () => {
  it('chiffre puis déchiffre', () => {
    const payload = encryptSecret('shipday_live_abc123', key);
    expect(payload.startsWith('v1.')).toBe(true);
    expect(payload).not.toContain('shipday_live_abc123');
    expect(decryptSecret(payload, key)).toBe('shipday_live_abc123');
  });

  it('produit un IV différent à chaque appel', () => {
    expect(encryptSecret('x', key)).not.toBe(encryptSecret('x', key));
  });

  it('refuse un secret altéré ou une mauvaise clé', () => {
    const payload = encryptSecret('secret', key);
    const parts = payload.split('.');
    const tampered = [
      parts[0],
      parts[1],
      parts[2],
      Buffer.from('autre').toString('base64url'),
    ].join('.');
    expect(() => decryptSecret(tampered, key)).toThrow();
    expect(() => decryptSecret(payload, randomBytes(32).toString('base64'))).toThrow();
  });

  it('masque un secret pour l’affichage', () => {
    expect(maskSecret('sk_live_1234567890')).toBe('sk_…7890');
    expect(maskSecret('court')).toBe('••••');
  });
});
