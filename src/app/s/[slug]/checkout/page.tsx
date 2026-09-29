import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CheckoutView } from '@/components/checkout/checkout-view';
import { cardPaymentsAvailable } from '@/lib/payments/gateway';
import { getStorefront } from '@/lib/storefront/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CheckoutPage({ params }: { params: { slug: string } }) {
  const storefront = await getStorefront(params.slug);
  if (!storefront) notFound();
  return (
    <CheckoutView
      storefront={storefront}
      cardAvailable={cardPaymentsAvailable(storefront.restaurant)}
      onSiteAvailable={storefront.location.onSitePaymentEnabled}
    />
  );
}
