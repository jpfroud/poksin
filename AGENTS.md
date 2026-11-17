# Poksin

Poksin est une application web collaborative d’estimation pour les équipes agiles.
Le projet et ses discussions de travail sont en français.

## Au début de chaque demande

1. Lire l’état du dépôt et les instructions pertinentes avant de modifier des fichiers.
2. Vérifier GStack avec `node scripts/gstack-status.cjs`.
3. Invoquer le routeur GStack puis nommer et exécuter le skill choisi.
4. Suivre le plan de travail de ce skill et vérifier les changements obtenus.

Une question simple sans skill pertinent peut recevoir une réponse directe avec mention de l’exception.
La conception, le développement, la correction et la livraison passent par GStack.
Si GStack est indisponible, poursuivre la préparation indépendante et réparer l’installation avant de développer.
La procédure est dans [docs/gstack.md](docs/gstack.md).

## Skill routing

| Demande | Skill GStack |
| --- | --- |
| Cadrer une idée ou un parcours | `office-hours` |
| Écrire une spécification d’implémentation | `spec` |
| Examiner l’architecture et le plan de tests | `plan-eng-review` |
| Concevoir l’interface ou son identité visuelle | `design-consultation` |
| Trouver la cause d’un dysfonctionnement | Protocole de diagnostic du routeur `gstack` |
| Examiner les changements de code | `review` |
| Vérifier le parcours dans le navigateur et corriger | `qa` |
| Examiner le parcours et produire un rapport | `qa-only` |
| Préparer la livraison ou la PR demandée | `ship` |

Employer le nom effectivement annoncé par l’hôte, souvent préfixé `gstack-` dans Codex.
Dans Codex, lire le routeur généré dans `.agents/skills/gstack/.agents/skills/gstack/SKILL.md` pour utiliser le profil de ce dépôt.
GStack v1.99.5.0 intègre le diagnostic de bugs au routeur après le retrait de `investigate`.
Lire [docs/gstack.md](docs/gstack.md) quand les skills, le verrou ou les hooks changent.
`UserPromptSubmit` rappelle le routage dans Codex pour les demandes de toute langue.
Un rappel de hook et un blocage sont deux preuves distinctes.
Garder les nouveaux hooks versionnés et conserver les hooks préexistants.

## Commandes disponibles

| Tâche | Commande |
| --- | --- |
| Préparer GStack sous Windows | `.\scripts\gstack-prepare.ps1` |
| Préparer GStack sous macOS ou Linux | `bash scripts/gstack-prepare.sh` |
| Vérifier la préparation | `node scripts/gstack-status.cjs` |
| Tester les scripts de hook | `node --test tests/gstack-hooks.test.cjs` |
| Construire puis démarrer | `npm ci`, `npm run build`, `npm start` |
| Contrôles rapides | `npm run check:quick` |
| Contrôles complets | `npm run check` |
| Tester le build au navigateur | `npm run build` puis `npm run test:e2e` |

Garder leurs scripts cohérents avec les tâches réellement exécutées par GitHub Actions.

## Parcours et interface

Lire [docs/parcours.md](docs/parcours.md) avant de concevoir ou de modifier le déroulement d’une salle.
Lire [DESIGN.md](DESIGN.md) pour les changements d’interface et [docs/exploitation.md](docs/exploitation.md) pour l’API, la persistance ou le déploiement.
La salle doit conserver les estimations, le contexte de vote et la file lors des actions adjacentes.
Un ticket s’ajoute depuis la session et la file reste accessible après un passage en mode Libre.
Un vote masqué reste privé côté serveur jusqu’à la révélation.
L’interface emploie un vocabulaire et une identité graphique propres à Poksin.
Les animations respectent `prefers-reduced-motion` et les interactions principales sont utilisables au clavier.
Clarifier les choix qui changent le produit, les droits, les données ou l’architecture.
Rendre les décisions courantes réversibles et suivre les états visibles dans le navigateur.

## Développement

- Partir d’un parcours utilisable de bout en bout et expliciter son critère d’acceptation.
- Limiter les changements au besoin et reprendre les mécanismes existants qui conviennent.
- Reproduire si possible un bug significatif avant la correction au niveau de test pertinent.
- Examiner les cas de concurrence, de rechargement et d’interruption qui touchent le parcours.
- Valider les entrées et les droits côté serveur. Vérifier en particulier le rôle de l’animateur.
- Placer les secrets dans la configuration de l’environnement d’exécution ou du CI.
- Consigner les règles de persistance, de migration et de restauration quand des données sont conservées.
- Documenter la raison d’un changement de seuil ou de périmètre d’un contrôle.

## Contrôles et livraison

Le premier incrément exécutable inclut le formatage, le lint, le typage, les tests unitaires et d’intégration, la couverture et le build de production.
Les cas E2E tournent avec le build de production. Ajouter ou adapter les scénarios touchés par chaque changement de parcours.
Utiliser des données isolées, les attentes Playwright et des sélecteurs stables ou des rôles accessibles.
Conserver les rapports et traces utiles en cas d’échec.
Exécuter les contrôles de dépendances, secrets et analyse statique en fonction des risques du code.
Ajouter une vérification de l’image de conteneur quand le projet en produit une.

Sur chaque PR, le résultat final stable exige `success` pour chaque contrôle obligatoire, E2E inclus.
Les statuts `failure`, `cancelled` et `skipped` échouent au contrôle final.
Épingler les actions tierces à un SHA et déclarer les permissions nécessaires par workflow ou tâche.
Activer et vérifier les protections GitHub de la branche principale sur le dépôt distant cible.
Prendre en compte les contributions humaines et les PR générées par les bots.

Configurer Dependabot à la semaine pour les écosystèmes présents, avec regroupements des paquets compatibles.
L’auto-merge requiert une PR authentifiée, des changements attendus, une classification explicite patch ou minor pour tout le groupe et chaque protection de branche.
Les changements majeurs, inconnus ou sensibles restent en revue manuelle.
Le workflow privilégié examine les métadonnées et les fichiers modifiés sans exécuter de code de la PR.
Vérifier une PR de bot réelle pour établir que les tests et les protections s’appliquent.
Lire [docs/reference-retrogemini.md](docs/reference-retrogemini.md) pour les décisions reprises du projet de référence.

## Fin de tâche

- Vérifier le résultat depuis le point d’entrée normal de l’utilisateur lorsque l’application est exécutable.
- Examiner les changements importants et tester les écrans et tailles concernés.
- Mettre à jour les commandes ou instructions qui ont changé.
- Rapporter les contrôles exécutés et leurs résultats, puis les conditions encore à vérifier.
- Distinguer configuration versionnée, exécution réussie et protection vérifiée comme bloquante.
- Identifier précisément les réglages distants et les droits nécessaires quand ils restent à établir.
