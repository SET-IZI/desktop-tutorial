import { getTranslations } from 'next-intl/server';
import { MeshGradient } from '@/components/ui/mesh-gradient';

export default async function StoreNotFound() {
  const t = await getTranslations('shop');
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <MeshGradient colors={['violet', 'blue', 'pink']} />
      <p aria-hidden className="relative text-[64px]">
        🍽️
      </p>
      <h1 className="relative mt-4 text-balance text-display-sm">{t('notFoundTitle')}</h1>
      <p className="relative mt-3 max-w-md text-fg">{t('notFoundHint')}</p>
    </main>
  );
}
