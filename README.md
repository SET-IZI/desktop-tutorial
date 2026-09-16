# 💈 BarberPro

Application mobile premium de réservation pour barber shop (iOS & Android), avec vitrine digitale du salon, des barbiers et des produits.

> Voir le PRD complet : [docs/PRD.md](docs/PRD.md) — Architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Structure du monorepo

```
barberpro/
├── docs/            # PRD, architecture
├── apps/
│   ├── mobile/      # Application mobile — React Native (Expo)
│   ├── api/         # Backend — NestJS + Prisma + PostgreSQL
│   └── admin/       # Dashboard administrateur — Next.js
```

## Fonctionnalités clés

- **Réservation** : choix du barber (ou premier disponible), prestation, créneaux en temps réel
- **Tarification dynamique** : tarifs soirée / nuit / week-end / jours fériés / urgence, prix personnalisés
- **Indicateur de retard** : statut du barber (🟢 à l'heure, 🟠 en retard, 🔴 +15 min) avec notification automatique
- **Galerie "Mes Coupes"** : photos avant/après attachées à chaque prestation
- **Catalogue produits** : vitrine e-commerce intégrée (cires, pommades, huiles…)
- **Fidélité** : 1 € dépensé = 1 point, récompenses configurables
- **Paiement** : Stripe (CB, Apple Pay, Google Pay), acompte optionnel, paiement sur place
- **Dashboards** : statistiques barber (CA, remplissage) et administration complète

## Démarrage rapide

### Backend (API)

```bash
cd apps/api
cp .env.example .env       # configurer DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY…
npm install
npx prisma migrate dev     # créer la base PostgreSQL
npm run start:dev          # http://localhost:3000
```

### Mobile

```bash
cd apps/mobile
npm install
npx expo start             # scanner le QR code avec Expo Go
```

### Admin

```bash
cd apps/admin
npm install
npm run dev                # http://localhost:3001
```

## Stack technique

| Couche | Technologie |
|---|---|
| Mobile | React Native (Expo), TypeScript |
| Backend | Node.js, NestJS, Prisma |
| Base de données | PostgreSQL |
| Stockage médias | AWS S3 |
| Notifications push | Firebase Cloud Messaging |
| Paiement | Stripe |
| Admin | Next.js |
