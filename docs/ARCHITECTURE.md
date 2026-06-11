# Architecture — BarberPro

## Vue d'ensemble

```
┌─────────────────┐     ┌─────────────────┐
│  Mobile (Expo)  │     │ Admin (Next.js) │
└────────┬────────┘     └────────┬────────┘
         │      REST / JSON      │
         └───────────┬───────────┘
                     ▼
            ┌────────────────┐
            │  API (NestJS)  │
            └───┬────┬───┬───┘
                │    │   │
      ┌─────────┘    │   └──────────┐
      ▼              ▼              ▼
 PostgreSQL      AWS S3        Firebase FCM
 (Prisma)     (photos/vidéos)  (push notifs)
                     │
                  Stripe
                (paiements)
```

## Backend — `apps/api`

NestJS organisé en modules métier, un par domaine fonctionnel du PRD :

| Module | Responsabilité | PRD |
|---|---|---|
| `auth` | Inscription, connexion (email/mdp, Google, Apple), JWT | §1 |
| `users` | Profil client, rôles (CLIENT / BARBER / ADMIN) | §1 |
| `barbers` | Profils barbiers, tags, stats, **statut de retard** | §2, §5 |
| `services` | Prestations (coupe, barbe, premium…) | §3 |
| `pricing` | **Moteur de tarification dynamique** (soirée, nuit, week-end, férié, urgence, personnalisé) | §4 |
| `bookings` | Disponibilités temps réel, réservation, historique, photos de prestation | §3, §6, §7 |
| `reviews` | Avis clients + paramètres de visibilité admin | §8 |
| `products` | Catalogue e-commerce, commandes | §9 |
| `loyalty` | Points de fidélité, récompenses | §11 |
| `payments` | Intégration Stripe, acomptes | §12 |
| `notifications` | Push Firebase (confirmation, rappels, retard…) | §10 |

### Moteur de tarification dynamique

`PricingService.computePrice()` applique les règles dans cet ordre :

1. **Prix personnalisé** (`CUSTOM`) : override absolu si une règle cible la prestation/le barber.
2. **Plage horaire fixe** (`NIGHT` avant `EVENING`) : prix fixe de remplacement — la plage la plus tardive gagne (après 22h prime sur après 20h).
3. **Majorations en pourcentage** (`WEEKEND`, `HOLIDAY`, `URGENCY`) : cumulatives, appliquées sur le prix retenu.

Les règles sont stockées en base (`PricingRule`) et administrables depuis le dashboard.

### Statut de retard

`PATCH /barbers/:id/delay-status` met à jour le statut (`ON_TIME`, `DELAY_5`, `DELAY_10`, `DELAY_15`, `DELAY_15_PLUS`, `ABSENT`) et déclenche une notification push à tous les clients ayant un rendez-vous confirmé avec ce barber dans la journée.

## Mobile — `apps/mobile`

Expo + React Navigation (bottom tabs) :

- **Accueil** : barbiers à la une avec badge de retard, accès rapide réservation
- **Réserver** : flow barber → prestation → créneau (prix dynamique affiché par créneau)
- **Mes Coupes** : galerie photo des prestations passées (téléchargement / partage)
- **Boutique** : catalogue produits, fiche produit, panier
- **Profil** : compte, historique, points fidélité

Thème premium : noir mat `#0D0D0D`, doré `#C9A227`, blanc, gris anthracite `#2E2E2E` (`src/theme.ts`).

## Admin — `apps/admin`

Next.js (App Router) : tableau de bord (CA, top prestations/produits/barbiers), gestion des barbiers, des tarifs dynamiques, des produits et des avis.

## Base de données

Schéma Prisma : `apps/api/prisma/schema.prisma`. Entités principales : `User`, `BarberProfile`, `Service`, `Appointment`, `AppointmentPhoto`, `PricingRule`, `Review`, `ReviewSettings`, `Product`, `Order`, `LoyaltyTransaction`, `DeviceToken`.
