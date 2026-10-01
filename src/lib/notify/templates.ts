/**
 * Emails transactionnels (logique pure, testée). Ton de marque : tutoiement côté
 * client, vouvoiement côté restaurateur ; un emoji maximum, en début de titre ;
 * jamais d'emoji dans un bouton, un prix ou une erreur.
 */

export type Locale = 'fr' | 'en';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface Layout {
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footer: string;
}

function render({ heading, paragraphs, cta, footer }: Layout): Omit<RenderedEmail, 'subject'> {
  const text = [
    heading,
    '',
    ...paragraphs,
    ...(cta ? ['', `${cta.label} : ${cta.url}`] : []),
    '',
    footer,
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1D1D1F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:28px;padding:32px">
<tr><td style="font-size:22px;font-weight:800;letter-spacing:-0.03em;padding-bottom:20px">miaamm<span style="color:#FF9F0A">.</span></td></tr>
<tr><td style="font-size:26px;font-weight:700;letter-spacing:-0.02em;line-height:1.2;padding-bottom:12px">${escapeHtml(heading)}</td></tr>
${paragraphs.map((p) => `<tr><td style="font-size:17px;line-height:1.5;padding-bottom:12px">${escapeHtml(p)}</td></tr>`).join('\n')}
${
  cta
    ? `<tr><td style="padding:12px 0 4px"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#0071E3;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:17px;padding:14px 26px;border-radius:999px">${escapeHtml(cta.label)}</a></td></tr>`
    : ''
}
</table>
<p style="max-width:520px;font-size:13px;color:#6E6E73;line-height:1.5;margin:16px auto 0">${escapeHtml(footer)}</p>
</td></tr></table></body></html>`;
  return { text, html };
}

export interface OrderEmailData {
  locale: Locale;
  number: number;
  restaurantName: string;
  customerName: string;
  trackingUrl: string;
  /** « vendredi 3 octobre à 12:30 », déjà formaté dans le fuseau de l'établissement. */
  when: string | null;
  address: string;
  total: string;
  paid: boolean;
}

const FOOTER = {
  fr: 'Commande passée sur Miaamm, la commande en ligne sans commission pour les restaurants indépendants.',
  en: 'Order placed with Miaamm, commission-free online ordering for independent restaurants.',
};

export function orderPlacedEmail(d: OrderEmailData): RenderedEmail {
  const fr = d.locale === 'fr';
  return {
    subject: fr
      ? `🎉 Commande n°${d.number} reçue chez ${d.restaurantName}`
      : `🎉 Order #${d.number} received by ${d.restaurantName}`,
    ...render({
      heading: fr ? `Merci ${d.customerName} !` : `Thanks ${d.customerName}!`,
      paragraphs: [
        fr
          ? `${d.restaurantName} a bien reçu ta commande n°${d.number}.`
          : `${d.restaurantName} has received your order #${d.number}.`,
        ...(d.when
          ? [fr ? `Retrait : ${d.when}, ${d.address}.` : `Pickup: ${d.when}, ${d.address}.`]
          : []),
        fr
          ? `Total : ${d.total}${d.paid ? ', payé en ligne' : ', à régler sur place'}.`
          : `Total: ${d.total}${d.paid ? ', paid online' : ', to pay on pickup'}.`,
        fr
          ? 'Suis ta commande en direct, on te dit quand elle est prête.'
          : "Follow your order live, we'll tell you when it's ready.",
      ],
      cta: { label: fr ? 'Suivre ma commande' : 'Track my order', url: d.trackingUrl },
      footer: FOOTER[d.locale],
    }),
  };
}

export function orderReadyEmail(d: OrderEmailData): RenderedEmail {
  const fr = d.locale === 'fr';
  return {
    subject: fr
      ? `🛍️ C'est prêt : commande n°${d.number} chez ${d.restaurantName}`
      : `🛍️ Ready: order #${d.number} at ${d.restaurantName}`,
    ...render({
      heading: fr ? "C'est prêt, viens le chercher" : "It's ready, come and get it",
      paragraphs: [
        fr
          ? `Ta commande n°${d.number} t'attend chez ${d.restaurantName}, ${d.address}.`
          : `Your order #${d.number} is waiting for you at ${d.restaurantName}, ${d.address}.`,
        ...(d.paid
          ? []
          : [fr ? `À régler sur place : ${d.total}.` : `To pay on pickup: ${d.total}.`]),
      ],
      cta: { label: fr ? 'Voir ma commande' : 'View my order', url: d.trackingUrl },
      footer: FOOTER[d.locale],
    }),
  };
}

export function orderCancelledEmail(
  d: OrderEmailData & { reason: string | null; refunded: boolean },
): RenderedEmail {
  const fr = d.locale === 'fr';
  return {
    subject: fr
      ? `Commande n°${d.number} annulée par ${d.restaurantName}`
      : `Order #${d.number} cancelled by ${d.restaurantName}`,
    ...render({
      heading: fr ? 'Ta commande est annulée' : 'Your order is cancelled',
      paragraphs: [
        d.reason ??
          (fr
            ? `${d.restaurantName} n'a pas pu préparer ta commande n°${d.number}.`
            : `${d.restaurantName} couldn't prepare your order #${d.number}.`),
        ...(d.refunded
          ? [
              fr
                ? `Tu as été remboursé de ${d.total} : le montant revient sur ta carte sous quelques jours.`
                : `You've been refunded ${d.total}: it will be back on your card within a few days.`,
            ]
          : []),
      ],
      footer: FOOTER[d.locale],
    }),
  };
}

export function teamInviteEmail(d: {
  locale: Locale;
  restaurantName: string;
  roleLabel: string;
  url: string;
}): RenderedEmail {
  const fr = d.locale === 'fr';
  return {
    subject: fr
      ? `Invitation à rejoindre l'équipe de ${d.restaurantName}`
      : `Invitation to join ${d.restaurantName}'s team`,
    ...render({
      heading: fr ? `Rejoignez ${d.restaurantName}` : `Join ${d.restaurantName}`,
      paragraphs: [
        fr
          ? `Vous êtes invité à rejoindre l'équipe de ${d.restaurantName} sur Miaamm, en tant que ${d.roleLabel}.`
          : `You're invited to join ${d.restaurantName}'s team on Miaamm, as ${d.roleLabel}.`,
        fr
          ? 'Ce lien est personnel, valable 7 jours, et fonctionne avec cette adresse email.'
          : 'This link is personal, valid for 7 days, and works with this email address.',
      ],
      cta: { label: fr ? "Rejoindre l'équipe" : 'Join the team', url: d.url },
      footer: fr
        ? 'Si vous ne vous attendiez pas à cette invitation, ignorez simplement cet email.'
        : "If you weren't expecting this invitation, simply ignore this email.",
    }),
  };
}
