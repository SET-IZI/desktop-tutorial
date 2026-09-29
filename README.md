# HubeVert — site vitrine

Site web d'une page pour **HubeVert** : élagage, abattage, entretien et aménagement
des espaces verts, pose de clôture et pavage — Fretin (59) et métropole lilloise.

Site statique, sans dépendance ni build : trois fichiers et un dossier d'images.

## Structure

```
index.html              contenu et structure de la page
assets/css/styles.css   mise en forme et animations
assets/js/main.js       menu mobile, apparitions au défilement, comparateur, formulaire
assets/                 photos, logo, favicon
```

## Aperçu en local

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## Mise en ligne (GitHub Pages)

Dans le dépôt : **Settings → Pages → Source: Deploy from a branch**, brancher sur
`main` / dossier `/ (root)`. Le site est publié tel quel, aucune compilation n'est
nécessaire. Un nom de domaine personnalisé s'ajoute dans le champ *Custom domain*.

## Modifier le contenu

| À changer | Où |
|---|---|
| Téléphone, e-mail, adresse | `index.html` — section `#contact`, bouton du menu, bloc `LocalBusiness` en bas de page, et `assets/js/main.js` (adresse du formulaire) |
| Lien Messenger | `index.html` — `https://m.me/hubevert`, à remplacer par l'URL exacte de la page Facebook |
| Textes des prestations | `index.html` — section `#services` |
| Photo d'accueil | `assets/elagage-corde.jpg` (format paysage, le sujet doit rester dans la moitié droite pour ne pas passer sous le titre) |
| Photos | remplacer les fichiers de `assets/` en gardant les mêmes noms (environ 1400 px de côté, JPEG) |
| Couleurs | `assets/css/styles.css` — variables `--green-*` en haut du fichier |

Le comparateur avant/après utilise `assets/conifere-avant.jpg` et `assets/conifere-apres.jpg` :
pour un rendu net, garder deux photos prises du même point de vue.

## Formulaire de devis

Le formulaire ouvre le logiciel de messagerie du visiteur avec un e-mail pré-rempli
vers `hubevert@gmail.com` — aucun serveur ni abonnement requis. Pour recevoir les
demandes sans passer par le client de messagerie du visiteur, un service comme
Formspree ou Web3Forms peut être branché sur l'attribut `action` du formulaire.

## Détails techniques

- Responsive (mobile, tablette, ordinateur), bouton d'appel flottant sur mobile.
- Animations discrètes : apparition au défilement, en-tête compact, zoom lent du hero,
  comparateur avant/après manipulable à la souris, au doigt et au clavier.
- `prefers-reduced-motion` respecté : les animations sont désactivées pour les
  visiteurs qui en font la demande.
- Référencement local : balises `title`/`description`, Open Graph et données
  structurées `LocalBusiness` (adresse, téléphone, zone d'intervention).
