import { describe, expect, it } from 'vitest';
import {
  orderCancelledEmail,
  orderPlacedEmail,
  orderReadyEmail,
  teamInviteEmail,
  type OrderEmailData,
} from '@/lib/notify/templates';

const order: OrderEmailData = {
  locale: 'fr',
  number: 42,
  restaurantName: 'Chez <Mimi>',
  customerName: 'Inès',
  trackingUrl: 'https://miaamm.app/s/chez-mimi/commande/abc123',
  when: 'vendredi 3 octobre à 12:30',
  address: '12 rue Oberkampf, 75011 Paris',
  total: '21,00 €',
  paid: false,
};

const emojiCount = (s: string) => [...s.matchAll(/\p{Extended_Pictographic}/gu)].length;

describe('emails de commande', () => {
  it('confirmation : numéro, retrait, total, lien de suivi ; un emoji en début de titre', () => {
    const mail = orderPlacedEmail(order);
    expect(mail.subject).toBe('🎉 Commande n°42 reçue chez Chez <Mimi>');
    expect(emojiCount(mail.subject)).toBe(1);
    expect(mail.text).toContain(
      'Retrait : vendredi 3 octobre à 12:30, 12 rue Oberkampf, 75011 Paris.',
    );
    expect(mail.text).toContain('Total : 21,00 €, à régler sur place.');
    expect(mail.text).toContain(
      'Suivre ma commande : https://miaamm.app/s/chez-mimi/commande/abc123',
    );
    expect(mail.html).toContain('href="https://miaamm.app/s/chez-mimi/commande/abc123"');
  });

  it('échappe le HTML des données saisies', () => {
    const mail = orderPlacedEmail(order);
    expect(mail.html).toContain('Chez &lt;Mimi&gt;');
    expect(mail.html).not.toContain('<Mimi>');
  });

  it('prête : rappel du montant à régler sur place seulement si non payée', () => {
    expect(orderReadyEmail(order).text).toContain('À régler sur place : 21,00 €.');
    expect(orderReadyEmail({ ...order, paid: true }).text).not.toContain('À régler');
    expect(orderReadyEmail(order).subject.startsWith('🛍️')).toBe(true);
  });

  it('annulation : motif, remboursement, jamais d’emoji', () => {
    const mail = orderCancelledEmail({
      ...order,
      paid: true,
      reason: 'La cuisine de Chez Mimi est débordée pour le moment.',
      refunded: true,
    });
    expect(emojiCount(mail.subject + mail.text)).toBe(0);
    expect(mail.text).toContain('La cuisine de Chez Mimi est débordée pour le moment.');
    expect(mail.text).toContain('Tu as été remboursé de 21,00 €');
  });

  it('anglais', () => {
    const mail = orderPlacedEmail({ ...order, locale: 'en', paid: true });
    expect(mail.subject).toBe('🎉 Order #42 received by Chez <Mimi>');
    expect(mail.text).toContain('Total: 21,00 €, paid online.');
  });
});

describe('invitation d’équipe', () => {
  it('vouvoiement, lien, sans emoji', () => {
    const mail = teamInviteEmail({
      locale: 'fr',
      restaurantName: 'Chez Mimi',
      roleLabel: 'Cuisine',
      url: 'https://miaamm.app/app/rejoindre/abc',
    });
    expect(mail.subject).toBe("Invitation à rejoindre l'équipe de Chez Mimi");
    expect(mail.text).toContain('Vous êtes invité');
    expect(mail.text).toContain("Rejoindre l'équipe : https://miaamm.app/app/rejoindre/abc");
    expect(emojiCount(mail.subject + mail.text)).toBe(0);
  });
});
