import { cn } from '@/lib/utils';

describe('cn', () => {
  it('ne confond pas les tailles de texte custom avec des couleurs', () => {
    expect(cn('text-cta-fg', 'text-body')).toBe('text-cta-fg text-body');
    expect(cn('text-fg', 'text-display-lg')).toBe('text-fg text-display-lg');
  });

  it('fusionne toujours les conflits réels', () => {
    expect(cn('text-body', 'text-display-sm')).toBe('text-display-sm');
    expect(cn('rounded-bento', 'rounded-bento-lg')).toBe('rounded-bento-lg');
    expect(cn('text-fg', 'text-red')).toBe('text-red');
  });
});
