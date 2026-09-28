# CLAUDE.md · Miaamm

SaaS de Click & Collect et de livraison pour restaurants indépendants. **Zéro commission.**
Objectifs : première commande prise en moins de 30 min côté restaurateur, commande client en moins de 60 s sans compte.

## Stack

- **Next.js 14** (App Router) + **TypeScript strict** (`noUncheckedIndexedAccess`)
- Tailwind CSS 3 + composants maison façon shadcn/ui (Radix), Framer Motion, Lucide
- Supabase (Postgres, Auth, Realtime, Storage), migrations via Supabase CLI
- Stripe Connect (Standard, direct charges, sans `application_fee`), Resend, Web Push, PWA
- Mapbox GL JS, Zod partout, next-intl (FR par défaut, EN)
- Vitest + Testing Library, Playwright + axe-core
- pnpm (version épinglée dans `packageManager`, activée via `corepack enable`), Node ≥ 20, déploiement Vercel

## Commandes

| Commande         | Rôle                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| `pnpm dev`       | Serveur de dev (http://localhost:3000)                                           |
| `pnpm build`     | Build de production (inclut lint + typecheck Next)                               |
| `pnpm lint`      | ESLint (next/core-web-vitals + jsx-a11y), 0 warning toléré                       |
| `pnpm typecheck` | `tsc --noEmit`                                                                   |
| `pnpm test`      | Tests unitaires Vitest (`tests/unit`, `src/**/*.test.ts(x)`)                     |
| `pnpm e2e`       | Playwright (desktop + mobile). **Lancer `pnpm build` avant** (sert `next start`) |
| `pnpm format`    | Prettier (+ tri des classes Tailwind)                                            |
| `pnpm check`     | format:check + lint + typecheck + test                                           |

Fin de phase : `pnpm check && pnpm build && pnpm e2e` doivent être verts.

## Arborescence

```
src/app/            routes (route groups par espace, voir plus bas)
src/components/ui/  primitives : Button, Card, Sheet, GlassBar, MeshGradient, Wordmark
src/lib/            logique pure et clients (env, crypto, color, motion, supabase/…)
src/i18n/           config next-intl (locale par cookie NEXT_LOCALE puis Accept-Language)
messages/           fr.json, en.json (mêmes clés, vérifié par un test)
supabase/           migrations, seed, tests RLS (phase 1)
tests/unit/         Vitest  ·  e2e/  Playwright
```

Espaces prévus : `s/[slug]` boutique client (réécrite depuis `{slug}.miaamm.app` par le middleware), `(dashboard)/app` back-office, `kitchen/[locationId]` écran cuisine, `driver` app livreur, `t/[token]` lien de suivi public, `embed/[slug]` widget. `/dev/ui` : vitrine du design system (noindex).

## Conventions de code

- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `test:`, `docs:`…), un commit par phase au minimum.
- Montants en **centimes (integer)**, devise EUR. Jamais de float pour l'argent. Prix toujours recalculés côté serveur.
- **Zod** pour toute entrée : formulaires, Server Actions, Route Handlers, webhooks, env.
- Accès aux données côté serveur (RSC, Server Actions, Route Handlers). Client Supabase navigateur **uniquement** pour Auth et Realtime.
- `createAdminClient()` (service role) seulement dans les webhooks, crons et la lecture des secrets. Tout module serveur importe `server-only`.
- Secrets restaurateur chiffrés en AES-256-GCM (`src/lib/crypto.ts`, format `v1.iv.tag.ciphertext`), jamais renvoyés au front (affichés masqués).
- Aucun secret dans le code : toute variable est dans `.env.example` et validée dans `src/lib/env.ts`. `.env*.local` est ignoré.
- API tierces : lire la doc officielle avant d'intégrer, ne jamais inventer d'endpoint ni de champ.
- Classes : toujours passer par `cn()` (tailwind-merge étendu aux tokens custom : `text-body`, `rounded-bento`…). Tout nouveau token de taille, radius ou ombre doit y être déclaré.
- Tests E2E : naviguer avec `gotoHydrated()` (attend `html[data-hydrated]`) avant d'interagir.

## Règles de design (Apple design language + Liquid Glass)

- Police **Inter Variable** avec axe `opsz` (coupe Display automatique), fallback `-apple-system`. Wordmark en **Nunito** (arrondie).
- Titres : `text-display-sm` (34), `-md` (44), `-lg` (56), `-xl` (80), weight 700, tracking -0.03em. Corps : `text-body` (17 px).
- Fonds : `bg-bg` (#F5F5F7 / #000), cartes `bg-surface` (#FFF / #1C1C1E). Sombre automatique (`prefers-color-scheme`), forçable via `data-theme` sur `<html>`.
- Palette : `blue` #0A84FF, `violet` #BF5AF2, `pink` #FF375F, `orange` #FF9F0A, `green` #30D158. Une couleur par catégorie de menu ou carte stat.
- **CTA principal** : `bg-cta` = #0071E3 (et non #0A84FF) pour tenir le contraste AA avec du texte blanc à 17 px.
- `--accent` : couleur du restaurant, texte choisi par `readableTextOn()`.
- Texte posé sur un `MeshGradient` : `text-fg` uniquement (jamais `text-fg-muted`, le contraste n'est pas garanti).
- `.glass` : blur 24 px + saturate 180 %, fond 60 %, bordure blanche 40 %, reflet en haut, fallback opaque. Réservé aux nav, bottom-sheets et panier flottant.
- Bento : `rounded-bento` (32 px), `-sm` 28, `-lg` 36, `shadow-soft` / `shadow-float`, jamais de bordure dure.
- Boutons en pilule, cibles de 44 px minimum. Ressort Framer `stiffness 300, damping 30`, tap 0.96 (`src/lib/motion.ts`). `MotionConfig reducedMotion="user"`.
- Icônes Lucide, trait 1.75 (forcé en CSS global sur `.lucide`).
- Un seul focus par écran, beaucoup d'espace vide, états vides et erreurs soignés, zéro jargon. WCAG AA vérifié par axe dans les e2e.

## Ton de marque

- Chaleureux, direct, un brin gourmand. Phrases courtes. **Tutoiement côté client, vouvoiement côté restaurateur.**
- Microcopy client : « Ton panier a l'air délicieux », « C'est en cuisine », « Ton livreur est en route », « C'est prêt, viens le chercher ».
- Pas de jeux de mots lourds, ni dans les écrans financiers, ni dans les erreurs critiques.

### Emojis

- Client : avec modération, un par élément max (catégories, statuts, états vides, confirmations, badges). Jamais empilés.
- Back-office, cuisine, livreur : icônes Lucide uniquement (sauf emoji de catégorie dans l'éditeur de menu).
- Emails et notifications : un emoji max, en début de titre.
- **Jamais** d'emoji dans un bouton d'action principal, un prix, une erreur ou un texte juridique.

## Décisions prises

| Date       | Décision                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-28 | Une seule app Next.js (route groups), pas de monorepo.                                                                            |
| 2026-09-28 | Next.js 14 comme demandé (montée de version possible plus tard).                                                                  |
| 2026-09-28 | Tailwind 3 (compatibilité shadcn/Next 14). Primitives UI écrites à la main façon shadcn.                                          |
| 2026-09-28 | Polices auto-hébergées via `@fontsource-variable` (build sans réseau vers Google Fonts, RGPD).                                    |
| 2026-09-28 | i18n sans préfixe d'URL : la langue vient du cookie `NEXT_LOCALE` puis d'`Accept-Language`, FR par défaut.                        |
| 2026-09-28 | CTA en #0071E3 pour le contraste AA ; #0A84FF reste la couleur d'accent et des icônes.                                            |
| 2026-09-28 | Variables d'env validées paresseusement par groupe (public/serveur) pour que chaque phase compile sans les clés des suivantes.    |
| 2026-09-28 | Pricing : gratuit jusqu'à 100 commandes/mois, puis abonnement fixe, sans commission.                                              |
| 2026-09-28 | SMS et numéros masqués derrière une interface `SmsProvider`/`ProxyPhoneProvider`, mock par défaut (pas de Twilio pour l'instant). |
| 2026-09-28 | Import du menu par IA via l'API Claude (vision + sortie structurée), toujours relu avant import.                                  |
| 2026-09-28 | Comptes client par magic link Supabase (pas de mot de passe).                                                                     |
| 2026-09-28 | Stripe Connect Standard + direct charges, sans `application_fee_amount`.                                                          |
| 2026-09-28 | `/dev/ui` reste accessible en prod (vitrine interne, `noindex`).                                                                  |

## Avancement

- [x] **Phase 0 · Setup** : Next 14 + TS strict, Tailwind + tokens clair/sombre, Liquid Glass, composants de base (Button, Card, Sheet, GlassBar, MeshGradient, Wordmark), i18n FR/EN, env Zod, chiffrement AES-GCM, clients Supabase, Vitest (18 tests), Playwright + axe (14 e2e : desktop et mobile, clair et sombre), CI GitHub Actions.
- [ ] Phase 1 · Base de données : migrations, RLS, seed, types générés
- [ ] Phase 2 · Boutique client : menu, fiche produit, panier, créneaux
- [ ] Phase 3 · Paiement : Stripe Connect, checkout invité, webhooks, confirmation
- [ ] Phase 4 · Back-office : onboarding, éditeur de menu, horaires, réglages
- [ ] Phase 5 · Temps réel : commandes, écran cuisine, suivi statuts, notifications
- [ ] Phase 6 · Livraison : zones, frais, adresse, DeliveryProvider, InternalProvider
- [ ] Phase 7 · Suivi live : app livreur PWA, Realtime, carte client, ETA
- [ ] Phase 8 · Intégrations : Uber Direct, Stuart, Shipday, e2e
- [ ] Phase 9 · Croissance : promos, fidélité, paniers abandonnés, campagnes, stats
- [ ] Phase 10 · Widget, QR code, landing + pricing
- [ ] Phase 11 · Polish : a11y, perf (Lighthouse > 90), e2e complet, README de déploiement

## Notes d'environnement

- Dans l'environnement cloud Claude Code, Chromium est préinstallé dans `/opt/pw-browsers` ; `playwright.config.ts` l'utilise automatiquement hors CI. Ne pas lancer `playwright install` en local.
- Si un `next start` d'un build précédent tourne encore sur le port e2e, Playwright le réutilise et l'hydratation échoue (chunks introuvables). Arrêter les anciens serveurs avant `pnpm e2e`.
