import { resolveTenantSlug } from '@/lib/tenant';

describe('sous-domaine boutique', () => {
  it('extrait le slug', () => {
    expect(resolveTenantSlug('chez-mimi.miaamm.app', 'miaamm.app')).toBe('chez-mimi');
    expect(resolveTenantSlug('Chez-Mimi.miaamm.app:443', 'miaamm.app')).toBe('chez-mimi');
    expect(resolveTenantSlug('chez-mimi.localhost:3000', 'localhost:3000')).toBe('chez-mimi');
  });

  it('ignore le domaine racine, les sous-domaines réservés et imbriqués', () => {
    expect(resolveTenantSlug('miaamm.app', 'miaamm.app')).toBeNull();
    expect(resolveTenantSlug('www.miaamm.app', 'miaamm.app')).toBeNull();
    expect(resolveTenantSlug('app.miaamm.app', 'miaamm.app')).toBeNull();
    expect(resolveTenantSlug('a.b.miaamm.app', 'miaamm.app')).toBeNull();
    expect(resolveTenantSlug('evil.com', 'miaamm.app')).toBeNull();
    expect(resolveTenantSlug('chez-mimi.miaamm.app', undefined)).toBeNull();
  });
});
