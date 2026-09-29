'use client';

import { Clock, ExternalLink, LayoutGrid, LogOut, Settings, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { signOut } from '@/app/(auth)/actions';
import { GlassBar } from '@/components/ui/glass-bar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ToastProvider } from '@/components/ui/toast';
import { Wordmark } from '@/components/ui/wordmark';
import { cn } from '@/lib/utils';
import { RushControl, type RushState } from './rush-control';

interface AdminShellProps {
  restaurant: { name: string; slug: string };
  canManage: boolean;
  rush: RushState | null;
  children: React.ReactNode;
}

const NAV = [
  { href: '/app', key: 'overview', icon: LayoutGrid, exact: true },
  { href: '/app/carte', key: 'menu', icon: UtensilsCrossed },
  { href: '/app/horaires', key: 'hours', icon: Clock },
  { href: '/app/reglages', key: 'settings', icon: Settings },
] as const;

/** Back-office : barre latérale (desktop) et barre d'onglets Liquid Glass (mobile). */
export function AdminShell({ restaurant, canManage, rush, children }: AdminShellProps) {
  const t = useTranslations('admin');
  const ta = useTranslations('auth');
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <ToastProvider>
      <div className="min-h-dvh lg:flex">
        {/* Barre latérale desktop */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line/[0.06] bg-surface/60 px-4 py-6 lg:flex">
          <Link href="/app" className="px-3" aria-label="Miaamm">
            <Wordmark className="text-[24px]" />
          </Link>
          <p className="mt-6 truncate px-3 text-[15px] font-semibold">{restaurant.name}</p>
          <nav aria-label="Back-office" className="mt-4 flex-1">
            <ul className="space-y-1">
              {NAV.map(({ href, key, icon: Icon, ...rest }) => {
                const active = isActive(href, 'exact' in rest);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-touch items-center gap-3 rounded-full px-3 font-medium transition-colors',
                        active
                          ? 'bg-fg/[0.08] font-semibold'
                          : 'text-fg-muted hover:bg-fg/[0.04] hover:text-fg',
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                      {t(`nav.${key}`)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="space-y-1">
            <a
              href={`/s/${restaurant.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-touch items-center gap-3 rounded-full px-3 font-medium text-fg-muted hover:bg-fg/[0.04] hover:text-fg"
            >
              <ExternalLink className="size-5" aria-hidden />
              {t('viewShop')}
            </a>
            <form action={signOut}>
              <button
                type="submit"
                className="flex min-h-touch w-full items-center gap-3 rounded-full px-3 font-medium text-fg-muted hover:bg-fg/[0.04] hover:text-fg"
              >
                <LogOut className="size-5" aria-hidden />
                {ta('logout')}
              </button>
            </form>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-line/[0.06] bg-bg/80 backdrop-blur-xl">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-6">
              <p className="min-w-0 flex-1 truncate font-semibold lg:invisible">
                {restaurant.name}
              </p>
              <a
                href={`/s/${restaurant.slug}`}
                target="_blank"
                rel="noreferrer"
                aria-label={t('viewShop')}
                className="flex size-11 items-center justify-center rounded-full bg-fg/[0.06] sm:order-2 lg:hidden"
              >
                <ExternalLink className="size-5" aria-hidden />
              </a>
              <ThemeToggle className="bg-fg/[0.06] shadow-none sm:order-3" />
              {/* Mobile : mode rush sur sa propre ligne, pleine largeur. */}
              {rush ? (
                <div className="order-last w-full sm:order-1 sm:w-auto">
                  <RushControl initial={rush} disabled={!canManage} />
                </div>
              ) : null}
            </div>
          </header>

          <main className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6 lg:pb-16">{children}</main>
        </div>

        {/* Onglets mobile */}
        <nav
          aria-label="Back-office"
          className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
        >
          <GlassBar className="justify-around rounded-[28px] px-1 py-1">
            {NAV.map(({ href, key, icon: Icon, ...rest }) => {
              const active = isActive(href, 'exact' in rest);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[12px] font-semibold transition-colors',
                    active ? 'bg-fg/[0.08] text-fg' : 'text-fg-muted',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {t(`nav.${key}`)}
                </Link>
              );
            })}
          </GlassBar>
        </nav>
      </div>
    </ToastProvider>
  );
}
