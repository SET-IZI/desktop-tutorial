import 'server-only';
import { Resend } from 'resend';
import { getEmailEnv } from '@/lib/env';
import { writeOutbox } from './outbox';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Même clé = même email, même si l'appel est rejoué (webhook, double clic). */
  idempotencyKey: string;
}

let client: Resend | null = null;

/** Envoie un email transactionnel. Ne lève jamais : une notification ne bloque pas une commande. */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  try {
    const env = getEmailEnv();
    if (env.mode === 'off') return false;
    if (env.mode === 'mock') {
      await writeOutbox('email', { ...message });
      return true;
    }
    client ??= new Resend(env.apiKey);
    const { error } = await client.emails.send(
      {
        from: env.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      },
      { idempotencyKey: message.idempotencyKey },
    );
    if (error) {
      console.error('[email]', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[email]', error);
    return false;
  }
}
