# Publier et déployer Poksin

## Publier une version

`package.json` fixe la version de l’application. Une étiquette Git `vX.Y.Z` correspondant à cette version, sur un commit de `main`, déclenche les contrôles CI. Une fois `poksin-ci` réussi, GitHub publie sur Docker Hub et joint `poksin-openshift.yaml` à la release GitHub. Le YAML désigne par digest l’image contrôlée que la CI a publiée.

Configurer `DOCKERHUB_USERNAME` dans les variables GitHub Actions et `DOCKERHUB_TOKEN` dans les secrets du dépôt. Utiliser un jeton Docker Hub dédié à la publication avec les autorisations de lecture et d’écriture. La CI publie dans le dépôt Docker Hub `poksin` du compte configuré. [Jetons Docker Hub](https://docs.docker.com/security/access-tokens/personal-access-tokens/)

## Appliquer une release

Télécharger `poksin-openshift.yaml` depuis la release. Vérifier le cluster et le projet avec `oc whoami --show-server` et `oc project`. À partir d’une session `oc` authentifiée sur le cluster voulu, remplacer `MON_PROJET` par le namespace de destination.

```sh
oc -n MON_PROJET apply --dry-run=server -f poksin-openshift.yaml
oc -n MON_PROJET apply -f poksin-openshift.yaml
oc -n MON_PROJET rollout status deployment/poksin --timeout=5m
oc -n MON_PROJET get route poksin -o jsonpath='{.spec.host}'
```

Ouvrir l’hôte retourné en HTTPS. `GET /healthz` doit répondre `{"ok":true}`. Partager l’adresse HTTPS de la salle pour tester l’invitation sur deux postes. L’application utilise la Route TLS pour les cookies sécurisés et maintient le flux SSE pour synchroniser les votes.

Si le dépôt Docker Hub est privé, créer un secret de pull dans le namespace avec un accès en lecture. Lier ce secret au compte de service `poksin` avec `oc -n MON_PROJET secrets link poksin poksin-dockerhub --for=pull`, puis relancer le déploiement. Utiliser un jeton de pull distinct du jeton de publication GitHub Actions. [Registres privés OpenShift](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html/images/managing-images)

## Stockage et mise à jour

Le manifeste crée le volume `poksin-data` de 1 Gio avec la classe RWO par défaut du projet. Le déploiement utilise un seul pod et la stratégie `Recreate`. Chaque mise à jour interrompt brièvement la connexion et réutilise la base SQLite du PVC. Les navigateurs se reconnectent au démarrage du nouveau pod. Conserver le PVC lors d’une mise à jour ou d’un redéploiement. Sauvegarder la base suivant [le guide d’exploitation](exploitation.md) avant une mise à jour qui change le schéma.

Pour revenir à une version, appliquer le manifeste de cette release après avoir vérifié sa compatibilité avec le schéma de la base. Le modèle versionné `k8s/openshift/poksin.yaml` est rendu avec `node scripts/render-openshift.mjs IMAGE@sha256:DIGEST` pour fournir un manifeste épinglé.
