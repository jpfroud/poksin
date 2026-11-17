# Contrôles et configuration GitHub

## Contrôles exécutés sur une PR

`Poksin CI` vérifie chaque PR, le candidat de la file de fusion, les commits poussés sur `main` et les tags de version. Le job `poksin-ci` exige quatre résultats `success`. Si un résultat vaut `failure`, `cancelled` ou `skipped`, la fusion reste bloquée lorsque le check est requis sur GitHub.

| Job requis        | Vérifications                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Qualité et build  | `npm ci`, `npm run check:quick`, `npm run test:coverage`, `npm run build`                                                             |
| E2E de production | `npm run build`, installation du Chromium Playwright, `npm run test:e2e` et traces d’échec conservées 7 jours                         |
| Sécurité          | Audit des deux verrous npm, Gitleaks sur l’historique du commit et Semgrep sur `src`                                                  |
| Conteneur         | Build Linux amd64, démarrage avec un UID arbitraire, accès SQLite et analyse Trivy des vulnérabilités hautes et critiques corrigibles |

Les audits npm échouent à partir de la sévérité haute. Les résultats plus faibles restent visibles dans le journal. Gitleaks et Semgrep exécutent des images verrouillées par digest, réseau désactivé et dépôt monté en lecture seule. La politique Semgrep du dépôt couvre l’évaluation de code dynamique et le rendu HTML brut des données de salle. GitHub Actions charge les PR avec un jeton en lecture et sans identifiants Git persistants. Pour mettre les scanners à jour, vérifier leur digest publié et remplacer le tag et le digest dans le workflow, puis exécuter le job `security`.

Pour reproduire les contrôles de sécurité en local, exécuter `npm audit --audit-level=high` et `npm audit --prefix tooling/gstack --audit-level=high`. Depuis Bash, reproduire les commandes Docker du job `security` avec Docker Desktop ou un moteur Linux, en définissant `GITHUB_WORKSPACE` sur le chemin absolu du clone. `npm run check` exécute les contrôles applicatifs locaux.

## Activation sur le dépôt distant

Ces réglages sont à appliquer par une personne ayant les droits d’administration sur le dépôt cible. Utiliser la branche configurée par défaut sur GitHub.

1. Avec les workflows présents sur la branche par défaut, lancer une exécution de `Poksin CI` pour faire apparaître le nom du check dans GitHub. Ouvrir **Settings → Rules → Rulesets** et créer une règle de branche active ciblant la branche par défaut. Exiger une PR, bloquer les suppressions et les push forcés. Garder vide la liste de contournement pour que la règle s’applique à tous, automatisations comprises.
2. Rendre `poksin-ci` obligatoire avec **GitHub Actions** comme source. Activer la vérification stricte de mise à jour de branche ou activer une file de fusion qui déclenche `merge_group`. Les revues supplémentaires restent à la main des mainteneurs et s’appliquent aussi aux PR Dependabot. [Règles GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
3. Ouvrir **Settings → General → Pull Requests** et autoriser **Allow auto-merge**. Activer le squash lorsque la branche utilise la fusion directe. Pour une file de fusion, choisir la méthode de fusion dans la règle de file. [Réglage d’auto-merge](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-auto-merge-for-pull-requests-in-your-repository)
4. Dans les réglages de sécurité, activer **Dependency graph**, **Dependabot alerts** et **Dependabot security updates**. Le fichier `.github/dependabot.yml` active les mises à jour de versions hebdomadaires pour les deux verrous npm, GitHub Actions et l’image de base Docker. [Mises à jour de sécurité](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-security-updates)
5. Sur une PR ordinaire, vérifier les quatre jobs dans l’onglet Checks et l’état requis de `poksin-ci` dans la zone de fusion. Sur une PR d’essai vouée à échouer, observer que le bouton de fusion est bloqué. Répéter avec la première PR Dependabot éligible et confirmer que le workflow privilégié a demandé la fusion et que GitHub attend les protections, incluant une revue humaine si elle est configurée.

Pour relire les réglages actifs avec `gh` connecté au dépôt cible, remplacer `OWNER/REPO` et `BRANCH`. Le retour de la première commande doit contenir la règle de PR et le contexte `poksin-ci`. La seconde commande montre les identifiants nécessaires pour relire l’application effective et la liste de contournement en tant qu’administrateur.

```sh
gh api 'repos/OWNER/REPO/rules/branches/BRANCH'
gh api 'repos/OWNER/REPO/rulesets'
gh api 'repos/OWNER/REPO/rulesets/RULESET_ID'
gh api 'repos/OWNER/REPO' --jq '{default_branch, allow_auto_merge, allow_squash_merge}'
```

## Éligibilité des mises à jour automatiques

Le workflow de fusion suit une exécution réussie de `Poksin CI`, associée à la révision courante d’une PR Dependabot et dont le job `poksin-ci` a réussi. Il limite les fichiers acceptés aux deux manifestes npm de la racine et exige des commits Dependabot vérifiés. Chaque dépendance directe mise à jour doit figurer dans la liste positive React. Les comparaisons des verrous déterminent si chaque changement est un patch ou un minor stable et retiennent le niveau le plus élevé. Un changement de mainteneur signalé, une version majeure ou une version indéterminée entraîne une revue manuelle.

Les mises à jour de l’image de base Docker, de l’outillage de build, des tests, de Bun et des workflows reçoivent une revue humaine. Les jobs de CI couvrent ces PR comme les autres. Le workflow privilégié lit uniquement l’API GitHub et s’arrête en l’absence de règle active qui exige `poksin-ci` depuis GitHub Actions. Il demande la fusion sous réserve des règles de branche, sans checkout, sans cache partagé ni artefact de PR. [Événements GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)

La [procédure OpenShift](openshift.md) décrit les tags de version, le secret Docker Hub de la CI et le manifeste livré avec la GitHub Release.
