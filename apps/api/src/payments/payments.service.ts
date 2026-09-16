import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

// PRD §12 — carte bancaire, Apple Pay et Google Pay passent tous par
// Stripe PaymentIntents ; le paiement sur place est géré côté réservation
// (champ `paidOnSite`), avec option d'acompte (`depositCents`).
@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe | null;

  constructor(config: ConfigService) {
    const key = config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = key ? new Stripe(key, { apiVersion: '2023-10-16' }) : null;
  }

  async createPaymentIntent(amountCents: number, metadata: Record<string, string>) {
    if (!this.stripe) {
      return { clientSecret: null, warning: 'STRIPE_SECRET_KEY non configurée' };
    }
    const intent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'eur',
      automatic_payment_methods: { enabled: true }, // CB, Apple Pay, Google Pay
      metadata,
    });
    return { clientSecret: intent.client_secret };
  }
}
