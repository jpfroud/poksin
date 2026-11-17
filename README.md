# Poksin

Planning poker pour les estimations d’équipe. Créez une salle, partagez son lien puis votez ensemble. L’animateur peut ajouter un ticket en pleine manche et passer de la file de tickets à une estimation libre. Chaque mode conserve sa manche en cours.

## Démarrer

Utiliser la version Node.js dans [`.node-version`](./.node-version) puis lancer :

```sh
npm ci
npm run build
npm start
```

Ouvrir [Poksin sur le port 3000](http://127.0.0.1:3000). Pour essayer le vote à plusieurs sur le même poste, ouvrir le lien de la salle dans un navigateur privé.

## Développer et vérifier

- `npm run check:quick` exécute le formatage, le lint, le typage, les tests des hooks et les tests serveur.
- `npx playwright install chromium` prépare le navigateur des tests E2E.
- `npm run check` exécute aussi la couverture, le build et la suite Playwright sur le serveur de production.
- `npm run dev` sert l’interface Vite. Lancer aussi `npm start` sur le port 3000 pour l’API après `npm run build:server`.

Le développement assisté utilise [GStack](docs/gstack.md). Les [critères d’acceptation](docs/parcours.md), les [choix graphiques](DESIGN.md) et les [détails d’exploitation](docs/exploitation.md) décrivent la première version.

Le [guide OpenShift](docs/openshift.md) décrit les releases Docker Hub et le déploiement du manifeste fourni par GitHub.
