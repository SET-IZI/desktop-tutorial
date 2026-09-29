/** Point d'entrée de l'aperçu statique de la boutique (sans serveur). */
import { MotionConfig } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { IntlProvider } from 'next-intl';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Storefront } from '@/components/shop/storefront';
import { computeSlots } from '@/lib/slots/compute';
import type { Storefront as StorefrontData } from '@/lib/storefront/types';
import { applyTheme, readStoredTheme } from '@/lib/theme';
import messages from '../../messages/fr.json';

declare const __STOREFRONT__: StorefrontData;
const storefront = __STOREFRONT__;

// Pas d'API ici : les créneaux sont calculés dans le navigateur à partir de la vraie config
// (horaires, préparation, capacité), sans charge cuisine.
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    location.href,
  );
  if (url.pathname.endsWith('/slots')) {
    const service = url.searchParams.get('service') === 'delivery' ? 'delivery' : 'pickup';
    const { location } = storefront;
    const result = computeSlots({
      now: new Date(),
      days: 3,
      leadMinutes: service === 'delivery' ? 30 : 0,
      config: {
        timezone: location.timezone,
        prepTimeMinutes: location.prepTimeMinutes,
        slotIntervalMinutes: location.slotIntervalMinutes,
        slotCapacity: location.slotCapacity,
        rushMode: location.rushMode,
        rushExtraMinutes: location.rushExtraMinutes,
        hours: location.hours.filter((h) => h.service === service),
        closures: location.closures,
      },
    });
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' },
    });
  }
  return realFetch(input, init);
};

/** Polices candidates (Google Fonts), essayables en direct dans l'aperçu. */
const FONTS = [
  { family: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans · moderne, chaleureuse' },
  { family: 'Figtree', label: 'Figtree · ronde, amicale' },
  { family: 'DM Sans', label: 'DM Sans · douce, géométrique' },
  { family: 'Nunito', label: 'Nunito · très arrondie, gourmande' },
  { family: 'Outfit', label: 'Outfit · géométrique, affirmée' },
  { family: 'Inter', label: 'Inter · la police actuelle' },
];
const FONT_KEY = 'miaamm:preview:font';

function readFont(): string {
  try {
    return localStorage.getItem(FONT_KEY) ?? FONTS[0]!.family;
  } catch {
    return FONTS[0]!.family;
  }
}

function FontPicker() {
  const [font, setFont] = useState(readFont);
  useEffect(() => {
    document.documentElement.style.setProperty('--font-sans', `'${font}'`);
    try {
      localStorage.setItem(FONT_KEY, font);
    } catch {
      // stockage indisponible : le choix vaut pour la session
    }
  }, [font]);
  // Pastille discrète en haut à gauche (le bouton clair/sombre est à droite) (défile avec la page, ne gêne pas la barre collante).
  return (
    <div className="glass absolute left-4 top-[max(1rem,env(safe-area-inset-top))] z-40 flex h-11 items-center gap-2 rounded-full pl-3.5 pr-3 text-[14px] font-semibold text-fg shadow-float">
      <span aria-hidden className="font-bold">
        Aa
      </span>
      <span aria-hidden className="max-w-[9rem] truncate font-medium">
        {font}
      </span>
      <ChevronDown className="size-4 text-fg-muted" aria-hidden />
      {/* Sélecteur natif transparent par-dessus : menu système sur mobile, accessible au clavier. */}
      <select
        aria-label="Police de l'aperçu"
        value={font}
        onChange={(e) => setFont(e.target.value)}
        className="absolute inset-0 cursor-pointer rounded-full opacity-0"
      >
        {FONTS.map((f) => (
          <option key={f.family} value={f.family}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PreviewNotice() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const onNavigate = () => setMessage('Aperçu : le paiement arrive en phase 3.');
    window.addEventListener('miaamm:preview-navigate', onNavigate);
    return () => window.removeEventListener('miaamm:preview-navigate', onNavigate);
  }, []);
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(null), 3500);
    return () => window.clearTimeout(id);
  }, [message]);
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 top-4 z-[60] mx-auto max-w-sm rounded-full bg-fg px-5 py-3 text-center text-[15px] font-semibold text-bg shadow-float"
    >
      {message}
    </div>
  );
}

applyTheme(readStoredTheme());

createRoot(document.getElementById('miaamm-root')!).render(
  <IntlProvider locale="fr" messages={messages} timeZone="Europe/Paris">
    <MotionConfig reducedMotion="user">
      <FontPicker />
      <Storefront storefront={storefront} />
      <PreviewNotice />
    </MotionConfig>
  </IntlProvider>,
);
