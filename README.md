# Hown Admin Web

Interface web légère pour créer des annonces Firestore dans le même esprit visuel que l'application iOS Hown. Le projet se compose uniquement de fichiers statiques (HTML/CSS/JS) et peut donc être hébergé très facilement sur GitHub Pages ou n'importe quel service statique.

## Fonctionnalités

- Authentification Firebase (email / mot de passe) pour respecter les règles existantes.
- Formulaire complet d'ajout d'annonce (tous les champs du modèle `Listing`).
- Gestion simple des images via une liste d'URL (compatible avec les champs `imageURL` et `imageURLs` de l'app mobile).
- Feedback immédiat (toast de succès/erreur, états de chargement, badge de session).
- UI cohérente avec l'application : fond dégradé, cartes translucides, typographie soignée.

## Structure

```
hown-admin-web/
├── app.js              # Logique Firebase + interactions DOM
├── config.sample.js    # Exemple de configuration Firebase (copier en config.js)
├── index.html          # Maquette de la page
├── styles.css          # Styles globaux
├── README.md
└── .gitignore
```

## Pré-requis

- Un projet Firebase déjà configuré (le même que l'app Hown).
- Activation des modules **Authentication** (Email/Password) et **Firestore**.
- Un utilisateur autorisé à créer des annonces (respect des règles Firestore existantes).

## Configuration

1. Ouvrir `config.js` et renseigner les valeurs fournies par la console Firebase (`Paramètres du projet > Vos applis > Web`). Le fichier est désormais versionné afin d'être servi sur un hébergement statique (Vercel, GitHub Pages, etc.).
2. Si vous préférez garder vos identifiants hors Git, copiez `config.sample.js` en local, remettez `config.js` dans `.gitignore`, puis déposez manuellement le fichier sur votre hébergeur.
3. Vérifier les règles Firestore pour autoriser la création d'annonces par l'utilisateur qui se connectera via ce portail.

## Lancer en local

La page étant statique, il suffit d'un petit serveur HTTP :

```bash
cd hown-admin-web
python3 -m http.server 4173
```

Ensuite ouvrez [http://localhost:4173](http://localhost:4173) dans votre navigateur.

> Vous pouvez utiliser n'importe quel autre serveur statique (`npx serve`, `php -S`, etc.).

## Déploiement GitHub

1. Initialiser un dépôt :

   ```bash
   cd hown-admin-web
   git init
   git add .
   git commit -m "feat: portail web d'ajout d'annonces"
   ```

2. Créer un dépôt GitHub vide puis pousser :

   ```bash
   git remote add origin git@github.com:<votre-compte>/hown-admin-web.git
   git push -u origin main
   ```

3. Activer GitHub Pages (branche `main`, dossier `/`).

4. Ajouter votre `config.js` directement sur l'hébergement (en S3, sur un serveur, ou via un secret GitHub Pages si vous utilisez un pipeline) **sans** le commiter.

## Personnalisation

- Les couleurs principales (`--hown-primary`, etc.) se changent dans `:root` dans `styles.css`.
- La typographie utilise Inter + Anton (Google Fonts). Vous pouvez remplacer l'import dans `index.html`.
- Le formulaire peut être enrichi (upload d'images, champs optionnels, auto-complétion). La logique principale d'envoi est centralisée dans `app.js` (`handleListingSubmit`).

## Limitations connues

- Pas de validation côté serveur : Firebase Firestore refuse de toute façon les champs manquants grâce aux règles.
- Pas de gestion directe des uploads : vous devez d'abord héberger vos images (Firebase Storage, Cloudinary, etc.) puis coller les URLs.
- La configuration Firebase n'est pas minifiée/obfusquée (standard Firebase : ces clés sont publiques).

---

Besoin d'un workflow plus poussé (framework JS, tests, CI/CD) ? On peut enrichir ce dossier ou repartir d'un framework (Vite/Next) quand Node.js sera disponible sur l'environnement cible.

