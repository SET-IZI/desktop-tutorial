# PRD — Application Mobile Barber Shop

## Nom du projet

**BarberPro**

## Objectif

Créer une application mobile iOS et Android permettant aux clients de réserver facilement un rendez-vous chez leur barbier tout en offrant une expérience premium autour de l'univers du salon.

L'application doit également servir de vitrine digitale pour le salon, les barbiers et les produits vendus.

---

## Utilisateurs

### Client

- Consultation des barbiers
- Réservation de rendez-vous
- Achat de produits
- Consultation de son historique
- Gestion de son profil

### Barber

- Gestion de son planning
- Gestion des prestations
- Gestion des photos avant/après
- Gestion de son statut (à l'heure, en retard, absent)

### Administrateur

- Gestion des utilisateurs
- Gestion des barbiers
- Gestion des prestations
- Gestion des produits
- Gestion des avis
- Gestion des tarifs spéciaux

---

## Fonctionnalités principales

### 1. Authentification

**Connexion**

- Email / mot de passe
- Google
- Apple
- Facebook (optionnel)

**Inscription** — informations :

- Nom
- Prénom
- Téléphone
- Email
- Date de naissance

### 2. Profil Barber

Chaque barbier possède une page dédiée.

**Informations**

- Photo de profil
- Galerie photo
- Vidéo de présentation
- Description
- Années d'expérience
- Spécialités

**Tags de compétences** (exemples)

- Dégradé américain
- Coupe afro
- Barbe
- Rasage traditionnel
- Hair Design
- Coloration

**Statistiques**

- Nombre de clients
- Nombre de prestations
- Note moyenne
- Taux de ponctualité

### 3. Réservation

**Choix du barber** — le client peut :

- Choisir un barber spécifique
- Choisir le premier disponible

**Choix de la prestation** (exemples)

- Coupe Homme
- Coupe + Barbe
- Barbe seule
- Coupe enfant
- Hair Design
- Premium Package

**Calendrier** — affichage :

- Disponibilités en temps réel
- Créneaux bloqués
- Créneaux spéciaux

### 4. Tarification dynamique

Le système doit permettre différents prix selon plusieurs critères.

| Tarif | Exemple |
|---|---|
| Normal | Coupe homme : 25 € |
| Soirée (après 20h) | 35 € |
| Nuit (après 22h) | 50 € |
| Week-end | Majoration configurable |
| Jours fériés | Majoration configurable |
| Urgence | Réservation moins de 2h avant le rendez-vous |
| Personnalisé | Prix personnalisé |

### 5. Indicateur de retard

Chaque barber peut activer :

- À l'heure
- 5 min de retard
- 10 min de retard
- 15 min de retard
- Plus de 15 min

Visible directement sur l'application :

- 🟢 À l'heure
- 🟠 10 min de retard
- 🔴 20 min de retard

Notification automatique aux clients concernés.

### 6. Historique des prestations

Pour chaque rendez-vous :

- Date
- Barber
- Prix payé
- Prestations réalisées

**Photos après prestation** — le barber peut prendre 1 à 10 photos, automatiquement attachées à la prestation. Le client retrouve toutes ses anciennes coupes dans son historique.

Exemple : *Coupe du 12/04/2026 — Photos : Face, Profil gauche, Profil droit, Arrière.*

### 7. Galerie personnelle du client

Le client possède un espace **« Mes Coupes »** : historique visuel de toutes ses prestations.

Possibilités :

- Télécharger les photos
- Partager
- Montrer au prochain barber

### 8. Avis clients

Système entièrement configurable. Paramètres admin :

- Afficher les avis : Oui / Non
- Afficher la note : Oui / Non
- Afficher les photos : Oui / Non

### 9. Catalogue Produits

Vitrine e-commerce intégrée.

**Catégories** : Cire, Pommade, Huile à barbe, Shampoing, Accessoires.

**Fiche produit** : Photos, Vidéo, Description, Prix, Stock.

Possibilité d'achat directement dans l'application.

### 10. Notifications

Push notifications :

- Confirmation de réservation
- Rappel J-1
- Rappel 1h avant
- Barber en retard
- Nouvelle disponibilité
- Promotion

### 11. Programme fidélité

Accumulation de points : **1 € dépensé = 1 point**.

Récompenses : réduction, produit offert, coupe offerte.

### 12. Paiement

Support :

- Carte bancaire
- Apple Pay
- Google Pay
- Paiement sur place

Option acompte obligatoire.

### 13. Tableau de bord Barber

Statistiques : CA du jour, CA semaine, CA mois, nombre de rendez-vous, taux de remplissage.

### 14. Dashboard Administrateur

Gestion complète : barbiers, produits, avis, réservations, promotions, tarifs dynamiques.

Statistiques : CA global, prestations populaires, produits les plus vendus, barbiers les plus réservés.

---

## Design

**Style** : Premium, moderne, inspiré de Fresha et Booksy.

**Couleurs** : Noir mat, Blanc, Doré, Gris anthracite.

**Animations** : fluides, transitions premium.

---

## Technologies recommandées

| Couche | Technologie |
|---|---|
| Frontend Mobile | React Native Expo |
| Backend | Node.js NestJS |
| Base de données | PostgreSQL |
| Stockage photos/vidéos | AWS S3 |
| Notifications | Firebase |
| Paiement | Stripe |
| Administration | Next.js |

---

## Fonctionnalités V2

- Liste d'attente intelligente
- IA recommandation de coupe
- Simulation de coiffure par photo
- Abonnement mensuel coupe illimitée
- Marketplace de barbiers indépendants
- Chat client/barber
- Appel vidéo avant rendez-vous
