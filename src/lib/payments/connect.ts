import 'server-only';
import { getPublicEnv } from '@/lib/env';
import { getStripe } from './gateway';

/**
 * Stripe Connect : compte du restaurateur avec tableau de bord Stripe complet
 * (équivalent « Standard »). Il paie ses frais Stripe et reste responsable des
 * litiges ; Miaamm ne prélève aucune commission.
 */

export async function createConnectedAccount(input: {
  restaurantId: string;
  restaurantName: string;
  email: string | undefined;
}): Promise<string> {
  const account = await getStripe().accounts.create(
    {
      country: 'FR',
      email: input.email,
      business_profile: { name: input.restaurantName },
      controller: {
        stripe_dashboard: { type: 'full' },
        fees: { payer: 'account' },
        losses: { payments: 'stripe' },
        requirement_collection: 'stripe',
      },
      metadata: { restaurant_id: input.restaurantId },
    },
    // Un seul compte par restaurant, même si l'action est rejouée.
    { idempotencyKey: `connect-account-${input.restaurantId}` },
  );
  return account.id;
}

/** Lien d'onboarding hébergé par Stripe (usage unique, expire vite). */
export async function createOnboardingLink(accountId: string): Promise<string> {
  const base = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const link = await getStripe().accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: `${base}/app/onboarding/stripe?refresh=1`,
    return_url: `${base}/app/onboarding/stripe`,
  });
  return link.url;
}

export async function getAccountStatus(accountId: string) {
  const account = await getStripe().accounts.retrieve(accountId);
  return { chargesEnabled: account.charges_enabled, detailsSubmitted: account.details_submitted };
}
