import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { getAiImportEnv } from '@/lib/env';
import { importDraftSchema, type ImportDraft } from './draft';

/**
 * Lecture d'une carte (photo ou PDF) par l'API Claude, en sortie structurée.
 * Le résultat n'est jamais importé tel quel : le restaurateur le relit d'abord.
 */

export const AI_IMPORT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export type AiImportType = (typeof AI_IMPORT_TYPES)[number];
export const AI_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export type AiImportResult =
  { ok: true; draft: ImportDraft } | { ok: false; error: 'off' | 'unreadable' | 'failed' };

// Schéma de sortie volontairement simple (pas de bornes) : la validation stricte
// se fait ensuite avec importDraftSchema.
const extractionSchema = z.object({
  categories: z.array(
    z.object({
      name: z.string(),
      products: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          price_eur: z.number(),
        }),
      ),
    }),
  ),
});

const SYSTEM = `Tu extrais la carte d'un restaurant à partir d'une photo ou d'un PDF de menu.
Recopie les catégories et les plats dans l'ordre du document, sans rien inventer :
- name : nom du plat tel qu'écrit (corrige seulement la casse si tout est en majuscules) ;
- description : composition ou détails visibles, sinon chaîne vide ;
- price_eur : prix en euros (13,50 → 13.5). Si plusieurs prix (tailles), garde le plus petit.
Ignore les plats sans prix lisible, les formules, les mentions légales et les coordonnées.
Si le document n'est pas une carte de restaurant, renvoie une liste de catégories vide.`;

const MOCK_DRAFT: ImportDraft = {
  categories: [
    {
      name: 'Entrées',
      products: [
        { name: 'Soupe à l’oignon', description: 'Gratinée au comté', priceCents: 750 },
        { name: 'Œuf mayo', description: '', priceCents: 550 },
      ],
    },
    {
      name: 'Plats',
      products: [{ name: 'Steak frites', description: 'Sauce au poivre', priceCents: 1850 }],
    },
  ],
};

function toDraft(extracted: z.infer<typeof extractionSchema>): AiImportResult {
  const candidate = {
    categories: extracted.categories
      .map((c) => ({
        name: c.name.trim().slice(0, 60),
        products: c.products
          .filter((p) => p.name.trim() && Number.isFinite(p.price_eur) && p.price_eur >= 0)
          .map((p) => ({
            name: p.name.trim().slice(0, 80),
            description: p.description.trim().slice(0, 600),
            priceCents: Math.round(p.price_eur * 100),
          })),
      }))
      .filter((c) => c.name && c.products.length > 0),
  };
  const parsed = importDraftSchema.safeParse(candidate);
  return parsed.success ? { ok: true, draft: parsed.data } : { ok: false, error: 'unreadable' };
}

export async function extractMenuFromFile(
  data: Buffer,
  mediaType: AiImportType,
): Promise<AiImportResult> {
  const env = getAiImportEnv();
  if (env.mode === 'off') return { ok: false, error: 'off' };
  if (env.mode === 'mock') return { ok: true, draft: MOCK_DRAFT };

  const client = new Anthropic({ apiKey: env.apiKey });
  const source =
    mediaType === 'application/pdf'
      ? ({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: data.toString('base64') },
        } as const)
      : ({
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: data.toString('base64') },
        } as const);

  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Si un classifieur de sécurité refuse, l'API relance sur un modèle de repli.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'medium', format: betaZodOutputFormat(extractionSchema) },
      messages: [
        {
          role: 'user',
          content: [source, { type: 'text', text: 'Extrais la carte de ce document.' }],
        },
      ],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return { ok: false, error: 'unreadable' };
    }
    return toDraft(response.parsed_output);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error('[menu-import] API Claude', error.status, error.message);
    } else {
      console.error('[menu-import]', error);
    }
    return { ok: false, error: 'failed' };
  }
}
