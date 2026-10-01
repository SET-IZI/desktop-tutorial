import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { Storefront } from '@/components/shop/storefront';
import { LOCATION_PARAM, withLocation } from '@/lib/storefront/location';
import { getStorefront } from '@/lib/storefront/queries';

interface Props {
  params: { slug: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const storefront = await getStorefront(params.slug);
  if (!storefront) return {};
  const { restaurant } = storefront;
  return {
    title: { absolute: `${restaurant.name} · Commande en ligne` },
    description: restaurant.description ?? undefined,
    openGraph: { title: restaurant.name, description: restaurant.description ?? undefined },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const storefront = await getStorefront(params.slug);
  return storefront ? { themeColor: storefront.restaurant.accentColor } : {};
}

export default async function StorePage({ params, searchParams }: Props) {
  const storefront = await getStorefront(params.slug);
  if (!storefront) notFound();
  const wanted = searchParams?.[LOCATION_PARAM];
  return (
    <Storefront storefront={withLocation(storefront, typeof wanted === 'string' ? wanted : null)} />
  );
}
