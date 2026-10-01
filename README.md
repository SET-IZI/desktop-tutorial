# Miaamm

Click & Collect et livraison pour restaurants indépendants. Zéro commission.

> En construction. L'avancement par phase est suivi dans [CLAUDE.md](./CLAUDE.md).

## Tester en local

Prérequis : Node 20+, Git et [Docker Desktop](https://www.docker.com/products/docker-desktop/) lancé (pour Supabase en local).

```bash
corepack enable                 # active la version de pnpm épinglée
pnpm install
cp .env.example .env.local      # valeurs prêtes pour le local (paiement, géocodage et IA simulés)
pnpm exec supabase start        # Postgres, Auth, Storage en local (Docker, 1er lancement : quelques minutes)
pnpm exec supabase db reset     # tables + démo « Chez Mimi »
pnpm dev                        # http://localhost:3000
```

Si `supabase start` affiche une `anon key` ou une `service_role key` différente de celles de `.env.local`, recopiez-les (`pnpm exec supabase status` les réaffiche).

| À ouvrir                          | Quoi                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| http://localhost:3000/s/chez-mimi | Boutique client (commande sans compte)                                                           |
| http://localhost:3000/login       | Back-office : `mimi@miaamm.test` / `miaamm-demo` (propriétaire), `cuisine@miaamm.test` (cuisine) |
| http://localhost:3000/signup      | Nouveau compte → onboarding en 5 étapes                                                          |
| http://127.0.0.1:54323            | Supabase Studio (voir les données)                                                               |

Arrêter : `Ctrl+C` puis `pnpm exec supabase stop`. Repartir de la démo : `pnpm exec supabase db reset`.

Sans Docker (Linux x64 uniquement) : `pnpm db:reset` sur un Postgres 16 local, `pnpm supabase:lite`, puis `pnpm dev`.

## Vérifier

```bash
pnpm check               # format, lint, typecheck, tests unitaires
pnpm build && pnpm e2e   # build de prod puis Playwright (desktop + mobile, axe WCAG AA)
```

Le guide de déploiement (Vercel + Supabase + Stripe) arrive en phase 11.
