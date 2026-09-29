// @vitest-environment node
import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const processed = vi.fn(async (..._args: unknown[]) => 'processed' as const);
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/payments/webhook', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/payments/webhook')>()),
  processStripeEvent: (...args: unknown[]) => processed(...args),
}));

const SECRET = 'whsec_test_secret';
const event = {
  id: 'evt_1',
  object: 'event',
  type: 'payment_intent.succeeded',
  account: 'acct_1',
  data: { object: { id: 'pi_1', object: 'payment_intent', amount: 2000, amount_received: 2000 } },
};

function signedRequest(payload: string, secret = SECRET) {
  const header = new Stripe('sk_test_123').webhooks.generateTestHeaderString({ payload, secret });
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': header },
    body: payload,
  });
}

describe('webhook Stripe · route', () => {
  beforeEach(() => {
    vi.stubEnv('MIAAMM_PAYMENTS_MODE', '');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', SECRET);
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    processed.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('accepte un événement correctement signé', async () => {
    const { POST } = await import('@/app/api/webhooks/stripe/route');
    const res = await POST(signedRequest(JSON.stringify(event)));
    expect(res.status).toBe(200);
    expect(processed).toHaveBeenCalledOnce();
    expect((processed.mock.calls[0]![1] as { id: string }).id).toBe('evt_1');
  });

  it('refuse une signature invalide, absente ou un corps modifié', async () => {
    const { POST } = await import('@/app/api/webhooks/stripe/route');
    expect((await POST(signedRequest(JSON.stringify(event), 'whsec_autre'))).status).toBe(400);
    expect(
      (await POST(new Request('http://localhost/x', { method: 'POST', body: '{}' }))).status,
    ).toBe(400);

    const tampered = signedRequest(JSON.stringify(event));
    const header = tampered.headers.get('stripe-signature')!;
    const forged = new Request('http://localhost/x', {
      method: 'POST',
      headers: { 'stripe-signature': header },
      body: JSON.stringify({ ...event, data: { object: { ...event.data.object, amount: 1 } } }),
    });
    expect((await POST(forged)).status).toBe(400);
    expect(processed).not.toHaveBeenCalled();
  });

  it('est désactivé en mode de paiement simulé', async () => {
    vi.stubEnv('MIAAMM_PAYMENTS_MODE', 'mock');
    const { POST } = await import('@/app/api/webhooks/stripe/route');
    expect((await POST(signedRequest(JSON.stringify(event)))).status).toBe(404);
  });
});

describe('webhook Stripe · traitement idempotent', () => {
  function fakeAdmin(insertErrorCode?: string, rpcError?: string) {
    const calls: string[] = [];
    const admin = {
      from: (table: string) => ({
        insert: async () => {
          calls.push(`insert:${table}`);
          return { error: insertErrorCode ? { code: insertErrorCode, message: 'dup' } : null };
        },
        delete: () => ({ eq: async () => (calls.push(`delete:${table}`), { error: null }) }),
      }),
      rpc: async (fn: string) => {
        calls.push(`rpc:${fn}`);
        return {
          data: rpcError ? null : 'order-id',
          error: rpcError ? { message: rpcError } : null,
        };
      },
    };
    return { admin: admin as unknown as SupabaseClient<Database>, calls };
  }

  it('traite un paiement réussi une seule fois', async () => {
    const { processStripeEvent } =
      await vi.importActual<typeof import('@/lib/payments/webhook')>('@/lib/payments/webhook');
    const first = fakeAdmin();
    expect(await processStripeEvent(first.admin, event as unknown as Stripe.Event)).toBe(
      'processed',
    );
    expect(first.calls).toEqual(['insert:stripe_events', 'rpc:mark_order_paid']);

    const replay = fakeAdmin('23505');
    expect(await processStripeEvent(replay.admin, event as unknown as Stripe.Event)).toBe(
      'duplicate',
    );
    expect(replay.calls).toEqual(['insert:stripe_events']);
  });

  it('libère l’événement si le traitement échoue (Stripe le rejouera)', async () => {
    const { processStripeEvent } =
      await vi.importActual<typeof import('@/lib/payments/webhook')>('@/lib/payments/webhook');
    const failing = fakeAdmin(undefined, 'boom');
    await expect(
      processStripeEvent(failing.admin, event as unknown as Stripe.Event),
    ).rejects.toThrow(/boom/);
    expect(failing.calls).toEqual([
      'insert:stripe_events',
      'rpc:mark_order_paid',
      'delete:stripe_events',
    ]);
  });

  it('ignore les événements non gérés', async () => {
    const { processStripeEvent } =
      await vi.importActual<typeof import('@/lib/payments/webhook')>('@/lib/payments/webhook');
    const { admin } = fakeAdmin();
    expect(
      await processStripeEvent(admin, {
        ...event,
        type: 'charge.refunded',
      } as unknown as Stripe.Event),
    ).toBe('ignored');
  });
});
