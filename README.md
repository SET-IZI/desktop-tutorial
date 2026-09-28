# Miaamm

Click & Collect et livraison pour restaurants indépendants. Zéro commission.

> En construction. L'avancement par phase est suivi dans [CLAUDE.md](./CLAUDE.md).

## Démarrer

```bash
corepack enable          # active la version de pnpm épinglée
pnpm install
cp .env.example .env.local
pnpm dev                 # http://localhost:3000, design system sur /dev/ui
```

## Vérifier

```bash
pnpm check               # format, lint, typecheck, tests unitaires
pnpm build && pnpm e2e   # build de prod puis Playwright (desktop + mobile, axe WCAG AA)
```

Le guide de déploiement (Vercel + Supabase + Stripe) arrive en phase 11.
