import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'BarberPro — Administration',
};

const nav = [
  { href: '/', label: 'Tableau de bord' },
  { href: '/pricing', label: 'Tarifs dynamiques' },
  { href: '/reviews', label: 'Avis clients' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          background: '#0D0D0D',
          color: '#FFFFFF',
          minHeight: '100vh',
          display: 'flex',
        }}
      >
        <aside style={{ width: 220, background: '#2E2E2E', padding: 24 }}>
          <h1 style={{ color: '#C9A227', fontSize: 20 }}>💈 BarberPro</h1>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
            {nav.map((item) => (
              <Link key={item.href} href={item.href} style={{ color: '#FFFFFF', textDecoration: 'none' }}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main style={{ flex: 1, padding: 32 }}>{children}</main>
      </body>
    </html>
  );
}
