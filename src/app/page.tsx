import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { GlassBar } from '@/components/ui/glass-bar';
import { MeshGradient } from '@/components/ui/mesh-gradient';
import { Wordmark } from '@/components/ui/wordmark';

// Page d'accueil provisoire (la vraie landing arrive en phase 10).
export default async function HomePage() {
  const t = await getTranslations('home');
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <MeshGradient />
      <GlassBar as="header" position="top">
        <Link href="/" className="rounded-full px-2 py-1" aria-label="Miaamm">
          <Wordmark className="text-[22px]" />
        </Link>
      </GlassBar>

      <main className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pb-24 pt-24 text-center sm:pt-36">
        <p className="text-[15px] font-semibold uppercase tracking-wider text-fg">{t('eyebrow')}</p>
        <h1 className="mt-4 text-balance text-display-sm sm:text-display-lg lg:text-display-xl">
          {t('title')}
        </h1>
        <p className="mt-6 max-w-xl text-balance text-[19px] text-fg">{t('subtitle')}</p>
        <p className="glass mt-10 inline-flex min-h-touch items-center gap-2 rounded-full px-5 font-semibold shadow-soft">
          <Sparkles className="size-5 text-orange" aria-hidden />
          {t('soon')}
        </p>
      </main>
    </div>
  );
}
