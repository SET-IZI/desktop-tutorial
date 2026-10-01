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

| Commande             | Rôle                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm dev`           | Serveur de dev (http://localhost:3000)                                                            |
| `pnpm build`         | Build de production (inclut lint + typecheck Next)                                                |
| `pnpm lint`          | ESLint (next/core-web-vitals + jsx-a11y), 0 warning toléré                                        |
| `pnpm typecheck`     | `tsc --noEmit`                                                                                    |
| `pnpm test`          | Tests unitaires Vitest (`tests/unit`, `src/**/*.test.ts(x)`)                                      |
| `pnpm e2e`           | Playwright (desktop + mobile). **Lancer `pnpm build` avant** (sert `next start`)                  |
| `pnpm format`        | Prettier (+ tri des classes Tailwind)                                                             |
| `pnpm check`         | format:check + lint + typecheck + test                                                            |
| `pnpm db:reset`      | Recrée la base Postgres locale : shim Supabase + migrations + seed                                |
| `pnpm test:db`       | Tests SQL (RLS, triggers, fonctions) sur `DATABASE_URL`, après `db:reset`                         |
| `pnpm supabase:lite` | API Supabase locale sans Docker : REST, Auth, Storage, Realtime sur `:54321` (base de `db:reset`) |
| `pnpm db:types`      | Régénère `src/types/database.ts` (Supabase CLI `--db-url`) : à committer                          |

Fin de phase : `pnpm check && pnpm db:reset && pnpm test:db && pnpm build && pnpm e2e` doivent être verts (`pnpm e2e` démarre lui-même supabase-lite et `next start`).

Dev local complet : `pnpm db:reset`, `pnpm supabase:lite` dans un terminal, `pnpm dev` dans un autre, puis http://localhost:3000/s/chez-mimi (ou http://chez-mimi.localhost:3000).

Nouvelle migration : `pnpm exec supabase migration new <nom> < /dev/null` (sans terminal, la CLI attend le SQL sur l'entrée standard), puis `pnpm db:reset && pnpm test:db && pnpm db:types`. La CI échoue si les types committés ne correspondent pas aux migrations.

## Arborescence

```
src/app/            routes (route groups par espace, voir plus bas)
src/components/ui/  primitives : Button, Card, Sheet, GlassBar, MeshGradient, Wordmark
src/lib/            logique pure et clients (env, crypto, color, motion, supabase/…)
src/i18n/           config next-intl (locale par cookie NEXT_LOCALE puis Accept-Language)
messages/           fr.json, en.json (mêmes clés, vérifié par un test)
src/types/          database.ts généré (ne pas éditer à la main)
supabase/           config.toml, migrations/ (SQL versionné), seed.sql (démo « Chez Mimi »)
scripts/db/         supabase-shim.sql (Postgres nu → API Supabase minimale), reset-local.sh
tests/unit/         Vitest  ·  tests/db/  Vitest + pg (RLS)  ·  e2e/  Playwright
```

Espaces prévus : `s/[slug]` boutique client (réécrite depuis `{slug}.miaamm.app` par le middleware), `(dashboard)/app` back-office, `kitchen/[locationId]` écran cuisine, `driver` app livreur, `t/[token]` lien de suivi public, `embed/[slug]` widget. `/dev/ui` : vitrine du design system (noindex).

## Modèle de données (phase 1)

- Tables : `restaurants`, `users_roles`, `menus`, `locations`, `opening_hours`, `location_closures`, `time_slots`, `categories`, `products`, `option_groups`, `options`, `customers`, `loyalty_accounts`, `promo_codes`, `campaigns`, `favorites`, `delivery_zones`, `drivers`, `orders`, `order_items`, `deliveries`, `delivery_events`, `delivery_tracks`, `delivery_provider_logs`, `provider_credentials`, `jobs`.
- Chaque table porte `restaurant_id`. Les liens parent/enfant passent par des **FK composites `(id, restaurant_id)`** : un objet ne peut pas être rattaché à un autre restaurant.
- **RLS partout** (vérifié par un test). Helpers `SECURITY DEFINER` : `is_staff`, `is_manager`, `is_owner`, `is_public_restaurant`, `owns_order`, `is_assigned_driver`.
  - Public (anon et clients) : catalogue des restaurants publiés uniquement.
  - `owner` : tout, y compris l'équipe. `manager` : catalogue, réglages, clients, promos, campagnes, livreurs, logs. `kitchen` : lecture, plus le statut des commandes.
  - Client : ses commandes (`orders.customer_user_id = auth.uid()`), y compris en session anonyme (checkout invité).
  - Livreur : ses courses, et l'écriture de ses positions tant que la course est active.
- **Privilèges par colonne** : l'équipe ne modifie que `status`, `extra_minutes`, `estimated_ready_at` et `cancel_reason` d'une commande (jamais les montants). `restaurants.stripe_account_id`/`order_seq` et `promo_codes.uses_count`, `drivers.user_id` et `customers.user_id` sont réservés au serveur. `provider_credentials.encrypted_secret` n'est lisible par personne hors `service_role`.
- Écritures réservées au serveur (`service_role`) : création de commande, paiement, `customers`, fidélité, `deliveries`, `delivery_events`, logs, secrets, `jobs`.
- Triggers : numéro de commande séquentiel par restaurant ; machine à états des commandes (`order_transition_allowed`) avec horodatage automatique ; sortie de `pending_payment` réservée au serveur ; lien de suivi expiré à la fin ; au moins un owner par restaurant.
- RPC : `create_restaurant(name, slug, location)`, `redeem_driver_invite(code)`, `slot_load(location, from, to)` (charge des créneaux, sans exposer les commandes), `purge_delivery_tracks()` (service_role, cron RGPD 24 h), `team_members(restaurant)`, `invite_details(token)`, `accept_team_invite(token)`, `import_menu(menu, draft)`. Table `team_invites` (phase 4d).
- Realtime : `orders`, `deliveries`, `delivery_events` dans `supabase_realtime`. Les positions GPS passeront par Broadcast privé (phase 7).
- Seed : comptes `mimi@` (owner), `cuisine@` (kitchen), `karim@` (livreur), `lea@` (cliente) `@miaamm.test`, mot de passe `miaamm-demo`. Invitation livreur `DEMO-NADIA`. Codes promo `BIENVENUE`, `LIVRAISONOFFERTE`.

## Boutique client (phase 2)

- Route `src/app/s/[slug]` (RSC). Le middleware réécrit `{slug}.<NEXT_PUBLIC_ROOT_DOMAIN>` vers `/s/{slug}` (`src/lib/tenant.ts`).
- Données : `getStorefront(slug)` (`src/lib/storefront/queries.ts`) passe par un client Supabase **anonyme sans cookies**, avec `unstable_cache` 60 s et le tag `storefront:{slug}`. **Toute modification de carte ou de réglages doit appeler `revalidateTag(storefrontTag(slug))`** (phase 4). Le modèle front est dans `src/lib/storefront/types.ts`, découplé des lignes SQL.
- Créneaux : `GET /api/storefront/[slug]/slots?service=pickup|delivery` (no-store) = `computeSlots()` (pur, `src/lib/slots/compute.ts`) + `slot_load` + `time_slots`.
- Panier : Zustand persisté dans `localStorage` (`miaamm:cart:{slug}`). La réhydratation est manuelle après le montage, puis `reconcileCart()` retire les produits disparus ou épuisés et réapplique les prix du jour. Logique pure dans `src/lib/cart/lines.ts`, réutilisée côté serveur en phase 3.
- Filtres (`src/lib/menu/filters.ts`) : recherche sans accents ni ligatures (œ → oe) ; « végé » inclut les plats vegan ; exclusion d'allergènes. Upsell (`src/lib/menu/upsell.ts`) : produits `is_upsell`, catégories absentes du panier en priorité.
- Lecture pure dans `src/lib/storefront/fetch.ts` (client Supabase injecté) ; `queries.ts` ajoute le cache Next. L'aperçu (`scripts/preview/`) réutilise les mêmes composants, avec des shims pour next/link, next/image et next-intl, et calcule les créneaux côté navigateur.
- Multi-établissements : `Storefront.locations` (actifs, du plus ancien au plus récent) et `Storefront.location` (affiché). `withLocation(storefront, id)` choisit l'établissement depuis `?etablissement=<id>` (boutique, checkout), `?location=<id>` (API créneaux) ou `locationId` (action `placeOrder`) ; inconnu → établissement par défaut. Pastilles « Nos adresses » dans l'en-tête quand il y en a plusieurs. **Une seule carte par restaurant**, partagée par tous ses établissements.
- Barre de catégories : défilement calculé en JS (pas de saut d'ancre, intercepté dans une iframe) et suivi verrouillé pendant le défilement. Jamais de `scrollIntoView` pendant un défilement de page : Safari et Chrome l'interrompent.
- Carte produit : toute la carte ouvre la fiche ; le « + » ajoute directement si aucun choix n'est obligatoire, sinon il ouvre la fiche. Pastille de quantité si le plat est déjà au panier.
- Animations au scroll : `Reveal` (`src/components/ui/reveal.tsx`) et parallaxe de l'en-tête, rendus statiques si `prefers-reduced-motion`.
- Cartes produit de hauteur fixe (136 px) : nom + description sur 3 lignes max, prix et badges sur une ligne (un badge qui ne tient pas est masqué, jamais coupé).
- Thème : automatique (système) par défaut ; bouton soleil/lune (`ThemeToggle`) qui pose `data-theme` et le mémorise (`miaamm:theme`). Un script inline dans `<head>` l'applique avant le premier rendu.
- Sheets : le CTA passe par la prop `footer` (zone fixe hors défilement), jamais en `sticky` dans le contenu.
- Police : une seule variable `--font-sans` (globals.css), actuellement Figtree.
- Composants : `src/components/shop/*`. Sur mobile, bottom-sheets en `.glass-thick` (88 % / 82 %) : le verre à 60 % n'est pas lisible sur du contenu dense. Pieds de sheet collants quasi opaques.

## Paiement et checkout (phase 3)

- Parcours : panier → `/s/[slug]/checkout` (tes infos + choix du paiement) → paiement (carte uniquement) → `/s/[slug]/commande/[token]`. Deux étapes max ; le paiement sur place tient en une seule.
- Action serveur `placeOrder` (`src/app/s/[slug]/checkout/actions.ts`) : Zod (`src/lib/checkout/schema.ts`), prix **recalculés** depuis la carte du jour (`priceOrder`), service ouvert, créneau réellement libre, moyen de paiement autorisé. Le client n'envoie que des identifiants et des quantités.
- `place_order()` (SQL, service_role) crée commande, lignes et fiche client **sous verrou** sur l'établissement : pas de surréservation d'un créneau, sous-total revérifié. Les paniers `pending_payment` réservent leur créneau 15 min.
- Stripe Connect **direct charges** (`src/lib/payments/gateway.ts`) : `paymentIntents.create(…, { stripeContext: acct, idempotencyKey: order-<id> })`, `automatic_payment_methods` (carte, Apple Pay, Google Pay), **sans `application_fee_amount`**. Côté client : `loadStripe(pk, { stripeAccount })`, Payment Element, `confirmPayment({ redirect: 'if_required' })`.
- Webhook `/api/webhooks/stripe` : signature vérifiée sur le corps brut (`constructEvent`), déduplication par `event.id` (`stripe_events`), événement relâché si le traitement échoue (Stripe rejoue). `mark_order_paid()` est idempotent et vérifie le montant.
- `MIAAMM_PAYMENTS_MODE=mock` : paiement simulé (dev/E2E) via `/api/checkout/mock-confirm`, qui joue le même traitement que le webhook. 404 dès que Stripe est configuré, interdit en production Vercel.
- Confirmation : lecture serveur par `public_token` (jamais exposée au client), suivie en temps réel depuis la phase 5 (voir plus bas).
- Stripe Connect côté restaurateur (création du compte, lien d'onboarding) : étape « Stripe » de l'onboarding en phase 4. `account.updated` tient déjà `stripe_charges_enabled` à jour.
- Documentation Stripe (`docs.stripe.com`) inaccessible depuis l'environnement cloud : intégration vérifiée sur les types officiels des SDK (`stripe` 22.x, API `2026-08-26.dahlia`, `@stripe/stripe-js`, `@stripe/react-stripe-js`).

## Back-office (phase 4)

- Routes : `/login`, `/signup` (`src/app/(auth)`), `/app/*` (`src/app/app/(shell)` : Aperçu, Carte, Horaires, Réglages), `/app/onboarding`. Le middleware rafraîchit la session Supabase (`@supabase/ssr`) et protège `/app` (redirection `/login?next=`, retour interne uniquement).
- Contexte : `requireRestaurant()` (utilisateur + restaurant actif, cookie `miaamm_restaurant`), `assertRole([...])` dans les actions. Toutes les écritures passent par le **client de l'utilisateur** : la RLS et les privilèges par colonne font foi. Après chaque écriture : `revalidateTag(storefrontTag(slug))`.
- Horaires : validation pure partagée (`src/lib/admin/schedule.ts`), remplacement atomique via `replace_opening_hours()` (SECURITY INVOKER, donc RLS appliquée).
- Mode rush (normal / ralenti / pause) accessible en un geste depuis l'en-tête.
- Vouvoiement côté restaurateur, icônes Lucide, pas d'emoji (sauf emoji de catégorie dans l'éditeur de carte).
- Auth locale : `supabase-lite` émule l'API Auth (`scripts/dev/auth-lite.mjs` : mot de passe, inscription, anonyme, refresh, getUser, logout), vérifiée avec le client officiel. En production, Supabase Auth.
- Éditeur de carte (`/app/carte`, `src/components/admin/menu/*`) : glisser-déposer dnd-kit (catégories, et plats dans leur catégorie, un `DndContext` par liste), poignée dédiée, annonces lecteur d'écran en français. Clavier : `listKeyboardCoordinates` avance d'un cran par flèche (la géométrie par défaut bloquait avec des hauteurs variables) et défilement instantané (`scrollBehavior: 'auto'`). Mises à jour optimistes avec retour arrière et toast en cas d'échec.
- Écritures de carte : `save_product(jsonb)` (plat + groupes d'options + options en une transaction, IDs conservés), `reorder_categories` / `reorder_products` ; toutes en SECURITY INVOKER (RLS appliquée). Rupture et visibilité en un geste depuis la liste.
- Photos : compressées côté navigateur (1600 px, WebP, repli JPEG), envoyées dans le bucket Storage `menu` sous `<restaurant_id>/…` (policy : manager du restaurant, 5 Mo, JPEG/PNG/WebP). Le serveur n'accepte que des URL publiques de ce dossier.
- Storage local : `scripts/dev/storage-lite.mjs` (envoi brut ou multipart comme storage-js, lecture publique, suppression), même règle d'accès que la policy (`is_manager` évalué avec l'identité de l'utilisateur). Fichiers dans `.tools/storage/` (ignoré par Git), jamais en production.
- Onboarding (`/app/onboarding`, `src/components/onboarding/*`, actions dans `src/app/app/onboarding/actions.ts`) : `restaurants.onboarding_step` = nombre d'étapes terminées (1 restaurant · 2 horaires · 3 carte · 4 paiements · 5 mise en ligne). On peut revenir sur une étape franchie (`?step=n`), jamais sauter en avant ; la création du restaurant n'est pas rejouable (modifications dans Réglages).
  - Restaurant : slug proposé depuis le nom (`slugify`, même règle que la base et les sous-domaines réservés), adresse géocodée côté serveur (`src/lib/geo/geocode.ts`) puis `create_restaurant()`. Slug déjà pris → erreur sur le champ.
  - Géocodage : service de la Géoplateforme IGN `https://data.geopf.fr/geocodage/search?q=…&limit=1` (successeur de l'API Adresse, réponse GeoJSON, score ≥ 0,5). **Non testé contre l'API réelle** (sortie réseau bloquée dans l'environnement de dev) : à vérifier au premier déploiement. `MIAAMM_GEOCODER=mock` en dev/E2E.
  - Horaires : `HoursEditor` réutilisé (props `onSaved`, `saveLabel`, `showClosures`), retrait uniquement.
  - Carte : import CSV (parseur pur `src/lib/menu-import/csv.ts`, « ; » ou « , », en-têtes FR/EN) ou photo/PDF lu par l'API Claude (`src/lib/menu-import/ai.ts` : `claude-opus-5-5`, sortie structurée Zod, repli serveur `fallbacks: 'default'` en cas de refus). Toujours relu avant `import_menu()` (SECURITY INVOKER, ajoute à la suite). Option photo masquée sans `ANTHROPIC_API_KEY` ; `MIAAMM_AI_IMPORT=mock` renvoie une carte d'exemple.
  - Paiements : Stripe Connect avec `controller` (tableau de bord complet, frais et litiges au restaurateur = équivalent Standard), `accountLinks` `account_onboarding`, retour sur `/app/onboarding/stripe` (statut relu, `?refresh=1` régénère le lien). Colonnes Stripe écrites uniquement par le serveur (service role). Réservé au propriétaire. Alternative : paiement sur place uniquement.
  - Mise en ligne : lien public (`shopPublicUrl`), QR code SVG généré côté serveur (`qrcode`), récapitulatif, publication → `/app?welcome=1`.
- Équipe (`/app/equipe`, owner : gestion, manager : lecture) : rôles `owner` / `manager` / `kitchen`, changement de rôle et retrait via `users_roles` (RLS owner, trigger « au moins un propriétaire »). Invitations par **lien personnel** (`/app/rejoindre/<jeton>`, 64 hex, 7 jours, usage unique) accepté seulement par le compte dont l'email correspond ; connexion/inscription conservent le lien (`?next=`). L'envoi par email arrivera avec Resend (phase 5) : le propriétaire copie le lien.
- Établissements (`/app/etablissements`, manager) : création géocodée, **masquée** par défaut (on règle ses horaires, puis on l'active) ; au moins un établissement reste visible. Établissement courant du back-office = cookie `miaamm_location` (`getCurrentLocation`), sélecteurs restaurant/établissement dans le shell (`ContextSwitcher`) dès qu'il y a le choix.
- Logo et bannière (Réglages) : `ImageUpload` réutilisé (logo 512 px, bannière 2000 px), même bucket `menu` et dossier `<restaurant_id>/`, URL contrôlées côté serveur (`isOwnImageUrl`, `src/lib/admin/storage-url.ts`). Sur la boutique, la bannière remplace le dégradé, sous un voile vers `bg` pour garder `text-fg` lisible.
- Navigation : Établissements et Équipe dans la barre latérale ; sur mobile (4 onglets), accessibles depuis Réglages, avec la déconnexion.

## Temps réel (phase 5)

- Écran cuisine `/app/cuisine` (hors shell, plein écran, toute l'équipe) : colonnes Nouvelles / En cuisine / Prêtes (onglets sur mobile), Accepter → Prête → Récupérée, « +10 min » (`extra_minutes`), refus/annulation avec motif (`cancel_reason`). Une commande payée par carte refusée est **remboursée** (`refundOrderPayment`, `refunds.create` sur le compte connecté, idempotent) et passe en `refunded` (service role). Données : `loadKitchenOrders()` (`src/lib/kitchen/orders.ts`), actions `src/app/app/cuisine/actions.ts` via le client de l'utilisateur (RLS + privilèges par colonne + trigger de transitions).
- Temps réel : abonnement `postgres_changes` sur `orders` filtré par `location_id`, puis `router.refresh()` ; filet de sécurité toutes les 30 s ; état « En direct / Reconnexion… ». **Toujours appeler `authorizeRealtime(supabase)` avant `.subscribe()`** (`src/lib/supabase/realtime.ts`) : sinon une session restaurée depuis les cookies rejoint le canal en anonyme et la RLS filtre tout.
- Suivi client (`/s/[slug]/commande/[token]`) : la session anonyme du checkout (`ensureGuestSession`, `src/lib/supabase/guest-session.ts`) relie la commande au navigateur (`customer_user_id`) ; `LiveOrder` s'abonne à `orders` `id=eq.<id>` (RLS `owns_order`) puis rafraîchit la page. Secours : 2,5 s pendant la confirmation du paiement, 15 s sans temps réel (lien ouvert sur un autre appareil), 60 s sinon. Retard annoncé (« Petit retard en cuisine ») et motif de refus/remboursement affichés au client.
- Son : carillon Web Audio (`src/lib/kitchen/chime.ts`), activé par un geste (bouton « Activer le son », préférence mémorisée), rappel toutes les 20 s tant qu'une commande attend.
- Notifications (`src/lib/notify/*`), jamais bloquantes (ne lèvent pas) :
  - Emails Resend (`emails.send`, `idempotencyKey` par événement) : confirmation de commande (lien de suivi), « C'est prêt », annulation/refus (motif, remboursement), invitation d'équipe. Gabarits purs et testés (`templates.ts`) : tutoiement client, vouvoiement équipe, un emoji max en début de titre, données échappées.
  - Déclencheurs : `placeOrder` (paiement sur place), webhook Stripe et `mock-confirm` (hook `onOrderPaid` de `processStripeEvent`, appelé seulement si la commande vient de passer en `new`), actions cuisine (prête, refus), `inviteMember`.
  - Web Push (`web-push`, VAPID) : alerte « Nouvelle commande n°X » à tous les appareils de l'équipe (`push_subscriptions`, RLS : chacun les siens, membre de l'équipe), abonnements expirés (404/410) supprimés. Service worker `public/sw.js` (clic → `/app/cuisine`), interrupteur dans Réglages affiché seulement si `NEXT_PUBLIC_VAPID_PUBLIC_KEY` existe, manifeste PWA (`src/app/manifest.ts`, requis sur iPhone). **Abonnement navigateur non testé de bout en bout** (service de push requis) : à vérifier au déploiement.
  - Modes simulés `MIAAMM_EMAIL_MODE=mock` / `MIAAMM_PUSH_MODE=mock` : messages écrits en JSON dans `MIAAMM_OUTBOX_DIR` (`.tools/outbox`), lus par les E2E (`e2e/outbox.ts`). Interdits en production.
- Realtime local : `scripts/dev/realtime-lite.mjs` (dans supabase-lite, `ws://127.0.0.1:54321/realtime/v1/websocket`), protocole Phoenix v2 relu dans `@supabase/realtime-js`, triggers `LISTEN/NOTIFY` posés au démarrage sur les tables de la publication `supabase_realtime`, RLS évaluée avec le JWT de l'abonné. `REALTIME_LITE_DEBUG=1` trace les messages. Lancer supabase-lite **après** `pnpm db:reset` (les triggers sont posés au démarrage).

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

- Police **Figtree** (auto-hébergée, `@fontsource-variable/figtree`, variable `--font-sans`), fallback `-apple-system`. Wordmark en **Nunito** (arrondie).
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

| Date       | Décision                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | Notifications envoyées en ligne (sans file `jobs`) et jamais bloquantes ; la file arrivera si les volumes l'exigent.                |
| 2026-10-01 | Cuisine : Accepter → Prête → Récupérée (le statut `preparing` reste disponible mais n'est pas utilisé par l'écran).                 |
| 2026-10-01 | Une carte par restaurant, partagée par ses établissements ; horaires, capacité et modes de commande par établissement.              |
| 2026-10-01 | Invitations d'équipe par lien copié (pas d'email avant Resend), liées à l'adresse invitée ; rôle owner attribué ensuite.            |
| 2026-09-29 | Géocodage par la Géoplateforme IGN (gratuit, sans clé, France) plutôt que Mapbox pour l'onboarding ; Mapbox reste pour les cartes.  |
| 2026-09-29 | Import de carte : pas d'emoji ni de photo déduits automatiquement ; le restaurateur complète dans l'éditeur.                        |
| 2026-09-29 | Onboarding sans Stripe possible (paiement sur place) pour ouvrir en moins de 30 min ; Stripe se connecte plus tard.                 |
| 2026-09-28 | Une seule app Next.js (route groups), pas de monorepo.                                                                              |
| 2026-09-28 | Next.js 14 comme demandé (montée de version possible plus tard).                                                                    |
| 2026-09-28 | Tailwind 3 (compatibilité shadcn/Next 14). Primitives UI écrites à la main façon shadcn.                                            |
| 2026-09-28 | Polices auto-hébergées via `@fontsource-variable` (build sans réseau vers Google Fonts, RGPD).                                      |
| 2026-09-29 | Checkout en retrait uniquement : la livraison (adresse, zone, frais) arrive en phase 6, le checkout propose de passer en retrait.   |
| 2026-10-01 | Invités : session Supabase **anonyme** créée au checkout (`ensureGuestSession`), commande liée par `customer_user_id`.              |
| 2026-09-29 | Paiement simulé (`mock`) pour dev/E2E/aperçu, jamais en production.                                                                 |
| 2026-09-29 | Police principale **Figtree** (choisie parmi 6 candidates dans l'aperçu), à la place d'Inter.                                       |
| 2026-09-28 | i18n sans préfixe d'URL : la langue vient du cookie `NEXT_LOCALE` puis d'`Accept-Language`, FR par défaut.                          |
| 2026-09-28 | CTA en #0071E3 pour le contraste AA ; #0A84FF reste la couleur d'accent et des icônes.                                              |
| 2026-09-28 | Variables d'env validées paresseusement par groupe (public/serveur) pour que chaque phase compile sans les clés des suivantes.      |
| 2026-09-28 | Pricing : gratuit jusqu'à 100 commandes/mois, puis abonnement fixe, sans commission.                                                |
| 2026-09-28 | SMS et numéros masqués derrière une interface `SmsProvider`/`ProxyPhoneProvider`, mock par défaut (pas de Twilio pour l'instant).   |
| 2026-09-28 | Import du menu par IA via l'API Claude (vision + sortie structurée), toujours relu avant import.                                    |
| 2026-09-28 | Comptes client par magic link Supabase (pas de mot de passe).                                                                       |
| 2026-09-28 | Stripe Connect Standard + direct charges, sans `application_fee_amount`.                                                            |
| 2026-09-28 | `/dev/ui` reste accessible en prod (vitrine interne, `noindex`).                                                                    |
| 2026-09-28 | Checkout invité = session **Supabase anonyme** : la RLS et Realtime fonctionnent pour les invités sans compte.                      |
| 2026-09-28 | Pas de PostGIS : lat/lng en `double precision`, polygones en GeoJSON `jsonb`, calculs géographiques côté app.                       |
| 2026-09-28 | Paliers de frais de livraison = plusieurs zones ordonnées par `position` (la première qui contient l'adresse s'applique).           |
| 2026-09-28 | Capacité cuisine = N commandes max par créneau ; `time_slots` ne stocke que les surcharges ponctuelles (bloqué, capacité).          |
| 2026-09-28 | Plages horaires sans passage à minuit (on coupe en deux) ; jours ISO 1 = lundi … 7 = dimanche.                                      |
| 2026-09-28 | Options de commande figées en `jsonb` dans `order_items` (instantané, insensible aux modifs de carte).                              |
| 2026-09-28 | Toujours un créneau : pas de « dès que possible » séparé ; le premier créneau libre est présélectionné (« Au plus tôt · 12:30 »).   |
| 2026-09-28 | Livraison : délai de trajet par défaut de 30 min dans les créneaux, tant que l'adresse (donc la zone) n'est pas connue (phase 6).   |
| 2026-09-28 | Boutique = établissement actif le plus ancien par défaut ; le client choisit son adresse (`?etablissement=`) s'il y en a plusieurs. |
| 2026-09-28 | Choix unique obligatoire = radio ; choix unique facultatif = case décochable ; aucune option n'est cochée par défaut.               |
| 2026-09-28 | E2E sans Docker : `supabase-lite` (PostgREST v12 + mini proxy `/rest/v1`), clés de dev publiques de la Supabase CLI.                |
| 2026-09-28 | Tests SQL en Vitest + `pg` (pas pgTAP) sur un Postgres nu + shim Supabase : tourne sans Docker, en local comme en CI.               |

## Avancement

- [x] **Phase 0 · Setup** : Next 14 + TS strict, Tailwind + tokens clair/sombre, Liquid Glass, composants de base (Button, Card, Sheet, GlassBar, MeshGradient, Wordmark), i18n FR/EN, env Zod, chiffrement AES-GCM, clients Supabase, Vitest (18 tests), Playwright + axe (14 e2e : desktop et mobile, clair et sombre), CI GitHub Actions.
- [x] **Phase 1 · Base de données** : 4 migrations (types, schéma, fonctions, RLS), seed « Chez Mimi » complet, 32 tests SQL (RLS, isolation, rôles, transitions, créneaux, livreur, purge RGPD), types générés et vérifiés en CI.
- [x] **Phase 2 · Boutique client** : carte avec barre collante et suivi de section, recherche et filtres, fiche produit (options, suppléments, note, quantité), panier persistant et réconcilié, upsell, retrait/livraison, créneaux selon la charge réelle (complets et bloqués grisés), sous-domaines, 404 soignée. 48 tests unitaires, 33 tests SQL, 40 e2e (desktop et mobile, axe clair et sombre).
- [x] **Phase 3 · Paiement** : checkout invité en 2 étapes max, prix recalculés côté serveur, création atomique sans surréservation, Stripe Connect direct charges sans commission (Payment Element : carte, Apple Pay, Google Pay), paiement sur place, webhook signé et idempotent, page de confirmation avec suivi du statut, mode simulé pour dev et E2E.
- [x] **Phase 4 · Back-office** : auth et shell (rush en un geste), réglages, horaires et fermetures, éditeur de carte (glisser-déposer souris et clavier, options, allergènes, photos, rupture), onboarding en 5 étapes (géocodage, import CSV ou photo par IA, Stripe Connect, lien + QR), équipe (rôles, invitations par lien), multi-établissements (back-office et boutique).
- [x] **Phase 5 · Temps réel** : écran cuisine en direct (Realtime, son, Accepter → Prête → Récupérée, retard, refus avec remboursement), suivi client en direct (session anonyme), emails transactionnels (Resend), alertes Web Push pour l'équipe, émulation Realtime locale.
- [ ] Phase 6 · Livraison : zones, frais, adresse, DeliveryProvider, InternalProvider
- [ ] Phase 7 · Suivi live : app livreur PWA, Realtime, carte client, ETA
- [ ] Phase 8 · Intégrations : Uber Direct, Stuart, Shipday, e2e
- [ ] Phase 9 · Croissance : promos, fidélité, paniers abandonnés, campagnes, stats
- [ ] Phase 10 · Widget, QR code, landing + pricing
- [ ] Phase 11 · Polish : a11y, perf (Lighthouse > 90), e2e complet, README de déploiement

## Notes d'environnement

- Pas de démon Docker dans l'environnement cloud : `supabase start` / `supabase db reset` ne tournent pas. Utiliser `pnpm db:reset` sur le Postgres 16 local (`service postgresql start`, mot de passe `postgres`). La Supabase CLI sert pour `migration new` et `gen types --db-url`.
- Ne jamais appliquer `scripts/db/supabase-shim.sql` sur un vrai projet Supabase.
- Dans l'environnement cloud Claude Code, Chromium est préinstallé dans `/opt/pw-browsers` ; `playwright.config.ts` l'utilise automatiquement hors CI. Ne pas lancer `playwright install` en local.
- E2E séquentiels (`workers: 1`) : la base de démo est partagée et certains tests la modifient temporairement (rush, horaires).
- Si un `next start` d'un build précédent tourne encore sur le port e2e, Playwright le réutilise et l'hydratation échoue (chunks introuvables). Arrêter les anciens serveurs avant `pnpm e2e`.
