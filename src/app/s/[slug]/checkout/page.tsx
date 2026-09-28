import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

// Étape provisoire : le checkout invité + Stripe arrive en phase 3.
export default async function CheckoutPage({ params }: { params: { slug: string } }) {
  const t = await getTranslations('shop');
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-display-sm">{t('checkoutSoon')}</h1>
      <Button asChild variant="secondary" className="mt-8">
        <Link href={`/s/${params.slug}`}>
          <ArrowLeft className="size-5" aria-hidden />
          {t('backToMenu')}
        </Link>
      </Button>
    </main>
  );
}
