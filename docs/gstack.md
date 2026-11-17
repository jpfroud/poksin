# GStack dans Poksin

Le dépôt fixe GStack [v1.99.5.0](https://github.com/garrytan/gstack/releases/tag/v1.99.5.0) au commit consigné dans `tooling/gstack/source.json`. Le verrou npm de `tooling/gstack/` fixe Bun et les binaires par plateforme. Le mode projet de GStack place le moteur et les skills Codex dans `.agents/skills/`. Git les ignore et chaque environnement les prépare à partir des sources verrouillées.

## Préparer un nouveau clone

Installer Git, Node.js et npm. Sous Windows, utiliser Git pour Windows, qui fournit Git Bash. Les téléchargements nécessitent un accès à GitHub et aux registres de paquets configurés. Dans le clone, lancer la commande correspondant au système.

```powershell
.\scripts\gstack-prepare.ps1
```

```bash
bash scripts/gstack-prepare.sh
```

Relancer la même commande après une interruption. Le script vérifie le commit téléchargé et les skills requis. Il passe `--no-browser` à l'installation officielle. GStack prépare Chromium à la première invocation d'un skill navigateur selon sa procédure officielle. Si le téléchargement est inaccessible, `GSTACK_CHROMIUM_PATH` permet à GStack de lancer un Chrome ou Chromium déjà installé. [Installation GStack](https://github.com/garrytan/gstack/blob/v1.99.5.0/docs/install.md)

Une seule préparation peut modifier un clone à la fois. Si un arrêt forcé laisse le répertoire vide `.cache/gstack/preparing`, le retirer après avoir vérifié que la préparation est arrêtée, puis relancer la commande.

`node scripts/gstack-status.cjs` vérifie le résultat local et retourne un code d'échec si la préparation manque ou si les skills requis sont absents. Ouvrir une nouvelle session Codex pour charger les skills installés après le démarrage de la session.

Pour exécuter les commandes Bash d’un skill, charger `source scripts/gstack-env.sh` dans ce même processus Bash. Le fichier ajoute Bun au `PATH` et dirige l’état GStack et son navigateur vers `.cache/gstack/` dans le clone.

Cette version inclut `office-hours`, `plan-eng-review`, `design-consultation`, `review`, `qa`, `qa-only` et `ship`. Pour un bug, suivre le diagnostic du routeur GStack et écrire un test reproductible lorsque la cause reste à établir. Ce protocole remplace le skill `investigate` dans cette version. [Historique GStack](https://github.com/garrytan/gstack/blob/v1.99.5.0/CHANGELOG.md)

## Routage et garde-fous

- **Codex.** Le hook natif `SessionStart` vérifie les fichiers locaux et `UserPromptSubmit` injecte le rappel de routage pour chaque prompt. Dans une nouvelle session du dépôt, vérifier la confiance du projet et examiner les hooks dans **Settings → Hooks** ou avec `/hooks` en CLI. L'approbation de leur définition appartient à l'utilisateur et reste locale à Codex. Ces deux hooks rappellent la consigne et signalent les prérequis manquants. Le projet exige GStack avant le développement via `AGENTS.md`. [Hooks Codex](https://learn.chatgpt.com/docs/hooks)
- **Claude Code.** Le générateur amont `gstack-team-init required` est le mode officiel et produit le garde-fou `Skill` de `.claude/settings.json`. Cette installation cible Codex. Pour utiliser Claude Code, suivre le mode équipe amont avec `./setup --host claude --team --skill-routing` et approuver ses hooks natifs. [Mode équipe GStack](https://github.com/garrytan/gstack/tree/v1.99.5.0#step-2-team-mode--auto-update-for-shared-repos-recommended)

`node --test tests/gstack-hooks.test.cjs` vérifie les réponses JSON du rappel sur deux demandes en français et le refus produit par le garde-fou officiel quand aucun moteur n’est trouvé. Pour vérifier le déclenchement natif dans Codex, exécuter les deux demandes dans une session avec les hooks approuvés et vérifier les événements `Routage GStack`.

Le bac à sable Windows peut interdire le démarrage de Git Bash. Lancer alors la préparation depuis un terminal Windows ordinaire. Si le chemin Git Bash diffère de celui de Git pour Windows, définir `GSTACK_GIT_BASH` pour le processus qui lance la préparation.

## Mettre à jour

Choisir une publication stable, relever le SHA de son commit puis mettre à jour `tooling/gstack/source.json`. Changer le verrou Bun avec la version testée par la publication si nécessaire. Dans un clone neuf, lancer la préparation puis `node scripts/gstack-status.cjs`, ouvrir une session et vérifier un prompt de cadrage et un prompt de correction en français. Tester le hook officiel là où il est actif. Examiner les modifications des hooks avant de demander à Codex d'approuver leur nouvelle définition.

Pour rafraîchir une installation locale après une mise à jour du verrou, fermer les sessions qui l'utilisent et déplacer `.agents/skills/gstack/` vers un répertoire de sauvegarde hors des chemins de découverte des skills. Relancer la préparation pour installer le nouveau commit. Le script s'arrête devant un checkout d'une autre version pour préserver son contenu.
