import 'server-only';
import { z } from 'zod';
import { getGeocoderMode } from '@/lib/env';

export interface GeocodeQuery {
  addressLine: string;
  postalCode: string;
  city: string;
}

export type GeocodeResult =
  | { ok: true; lat: number; lng: number; label: string }
  | { ok: false; error: 'not_found' | 'unavailable' };

/**
 * Service de géocodage de la Géoplateforme (IGN), successeur de l'API Adresse
 * (api-adresse.data.gouv.fr) : même réponse GeoJSON, sans clé, France uniquement.
 */
const ENDPOINT = 'https://data.geopf.fr/geocodage/search';
/** En dessous, le résultat est trop incertain pour placer le restaurant sur une carte. */
const MIN_SCORE = 0.5;

const responseSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z.object({ label: z.string(), score: z.number() }),
    }),
  ),
});

/** Extrait le meilleur résultat d'une réponse GeoJSON du service. */
export function parseGeocodeResponse(json: unknown): GeocodeResult {
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: 'unavailable' };
  const best = parsed.data.features[0];
  if (!best || best.properties.score < MIN_SCORE) return { ok: false, error: 'not_found' };
  const [lng, lat] = best.geometry.coordinates;
  return { ok: true, lat, lng, label: best.properties.label };
}

export async function geocodeAddress(query: GeocodeQuery): Promise<GeocodeResult> {
  if (getGeocoderMode() === 'mock') {
    // Paris centre : suffisant pour les créneaux et l'aperçu, jamais en production.
    return {
      ok: true,
      lat: 48.8566,
      lng: 2.3522,
      label: `${query.addressLine} ${query.postalCode} ${query.city}`,
    };
  }
  const url = new URL(ENDPOINT);
  url.searchParams.set('q', `${query.addressLine} ${query.postalCode} ${query.city}`);
  url.searchParams.set('limit', '1');
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!res.ok) return { ok: false, error: 'unavailable' };
    return parseGeocodeResponse(await res.json());
  } catch {
    return { ok: false, error: 'unavailable' };
  }
}
