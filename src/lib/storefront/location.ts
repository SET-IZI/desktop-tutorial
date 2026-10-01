import type { Storefront } from './types';

/**
 * Boutique vue depuis un établissement donné (identifiant venu de l'URL ou du
 * client) : inconnu ou inactif → établissement par défaut.
 */
export function withLocation(storefront: Storefront, locationId?: string | null): Storefront {
  const location = locationId ? storefront.locations.find((l) => l.id === locationId) : undefined;
  return location ? { ...storefront, location } : storefront;
}

/** Paramètre d'URL de la boutique et du checkout. */
export const LOCATION_PARAM = 'etablissement';
