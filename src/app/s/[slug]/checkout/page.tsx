import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CheckoutView } from '@/components/checkout/checkout-view';
import { cardPaymentsAvailable } from '@/lib/payments/gateway';
import { LOCATION_PARAM, withLocation } from '@/lib/storefront/location';
import { getStorefront } from '@/lib/storefront/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const shop = await getStorefront(params.slug);
  if (!shop) notFound();
  const wanted = searchParams[LOCATION_PARAM];
  const storefront = withLocation(shop, typeof wanted === 'string' ? wanted : null);
  return (
    <CheckoutView
      storefront={storefront}
      cardAvailable={cardPaymentsAvailable(storefront.restaurant)}
      onSiteAvailable={storefront.location.onSitePaymentEnabled}
    />
  );
}
