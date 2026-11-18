# Publier et déployer Poksin

## Publier une version

`package.json` fixe la version de l’application. Une étiquette Git `vX.Y.Z` correspondant à cette version, sur un commit de `main`, déclenche les contrôles CI. Une fois `poksin-ci` réussi, GitHub publie sur Docker Hub et joint `poksin-openshift.yaml` à la release GitHub. Ce manifeste désigne par digest l’image contrôlée.

Configurer `DOCKERHUB_USERNAME` dans les variables GitHub Actions et `DOCKERHUB_TOKEN` dans les secrets du dépôt. Utiliser un jeton Docker Hub dédié à la publication avec les autorisations de lecture et d’écriture. La CI publie dans le dépôt Docker Hub `poksin` du compte configuré. [Jetons Docker Hub](https://docs.docker.com/security/access-tokens/personal-access-tokens/)

## Déployer dans un projet OpenShift

Depuis la racine du dépôt, utiliser [le manifeste OpenShift](../k8s/openshift/poksin.yaml). Il référence l’image Docker Hub par digest. Dans une session PowerShell où `oc` est authentifié, renseigner l’URL de l’API du cluster et le namespace de destination.

```powershell
$serveur = Read-Host "URL de l’API OpenShift"
$projet = Read-Host 'Namespace du projet'
$manifeste = 'k8s/openshift/poksin.yaml'
$registre = (Read-Host "Nom d’hôte du registre du cluster, ou Entrée pour Docker Hub").Trim()

if ($registre) {
    $image = Select-String -LiteralPath $manifeste -Pattern '^\s+image:\s+docker\.io/(\S+)\s*$'
    $reference = $image.Matches[0].Groups[1].Value
    $yaml = node scripts/render-openshift.mjs "$registre/$reference"
    if ($LASTEXITCODE -ne 0) { throw 'Génération du manifeste impossible.' }
    $manifeste = Join-Path ([IO.Path]::GetTempPath()) 'poksin-openshift-local.yaml'
    $yaml | Set-Content -LiteralPath $manifeste -Encoding utf8
}

oc --server=$serveur --namespace=$projet apply --dry-run=server -f $manifeste
if ($LASTEXITCODE -ne 0) { throw 'Échec du dry-run OpenShift.' }
oc --server=$serveur --namespace=$projet apply -f $manifeste
if ($LASTEXITCODE -ne 0) { throw 'Échec du déploiement OpenShift.' }
oc --server=$serveur --namespace=$projet rollout status deployment/poksin --timeout=5m
if ($LASTEXITCODE -ne 0) { throw 'Le déploiement Poksin ne devient pas prêt.' }
oc --server=$serveur --namespace=$projet get route poksin -o jsonpath='{.spec.host}'
```

Pour utiliser un registre interne, saisir uniquement son nom d’hôte, sans `https://` ni chemin. La commande conserve le chemin de l’image et son digest, puis écrit le manifeste adapté dans le répertoire temporaire du poste.

Ouvrir l’hôte retourné en HTTPS. `GET /healthz` doit répondre `{"ok":true}`. Partager l’adresse HTTPS de la salle pour tester l’invitation sur deux postes. L’application utilise la Route TLS pour les cookies sécurisés et maintient le flux SSE pour synchroniser les votes.

Pour déployer une version publiée, télécharger `poksin-openshift.yaml` depuis la release et utiliser ce fichier comme `$manifeste`. Si le cluster utilise un registre interne, remplacer localement le nom d’hôte sur la ligne `image:` en conservant le chemin de l’image et son digest.

Si le dépôt Docker Hub est privé, créer un secret de pull dans le namespace avec un accès en lecture. Lier ce secret au compte de service `poksin` avec `oc --server=$serveur --namespace=$projet secrets link poksin poksin-dockerhub --for=pull`, puis relancer le déploiement. Utiliser un jeton de pull distinct du jeton de publication GitHub Actions. [Registres privés OpenShift](https://docs.redhat.com/en/documentation/openshift_container_platform/4.20/html/images/managing-images)

## Conserver une adresse publique supplémentaire

Le manifeste générique lit la clé facultative `POKSIN_PUBLIC_URL` du ConfigMap `poksin-config`. Configurer cette valeur une fois dans le projet de destination conserve le préfixe public lors des mises à jour suivantes. Par exemple, `https://tools.example.org/poksin` permet de conserver l’accès direct à la racine et d’ajouter un accès derrière un proxy qui transmet l’hôte public et retire `/poksin`.

```powershell
oc --server=$serveur --namespace=$projet create configmap poksin-config --from-literal=POKSIN_PUBLIC_URL=https://tools.example.org/poksin --dry-run=client -o yaml | oc --server=$serveur --namespace=$projet apply -f -
```

Conserver la Route supplémentaire et les valeurs propres au déploiement dans la configuration de l’environnement, hors du dépôt applicatif public. La Route doit joindre le même Service et retirer le préfixe avant d’envoyer la requête à l’application ; avec le routeur OpenShift, utiliser l’annotation `haproxy.router.openshift.io/rewrite-target: /`. Les mises à jour ordinaires du manifeste gardent la référence au ConfigMap. L’application sélectionne le préfixe uniquement pour l’hôte exact configuré, et utilise la racine pour les autres hôtes.

Après autorisation de la fenêtre d’interruption nécessaire au pod SQLite, appliquer le manifeste épinglé de la version choisie. Aucun paramètre d’environnement n’est publié par la CI.

## Stockage et mise à jour

Le pod réserve `1m` de CPU et `128Mi` de mémoire. Sa limite mémoire est de `384Mi`. La `LimitRange` du projet peut fixer une limite CPU par défaut.

Le manifeste crée le volume `poksin-data` de 1 Gio avec la classe RWO par défaut du projet. Le déploiement utilise un seul pod et la stratégie `Recreate`. Chaque mise à jour interrompt brièvement la connexion et réutilise la base SQLite du PVC. Les navigateurs se reconnectent au démarrage du nouveau pod. Conserver le PVC lors d’une mise à jour ou d’un redéploiement. Sauvegarder la base suivant [le guide d’exploitation](exploitation.md) avant une mise à jour qui change le schéma.

Pour revenir à une version, appliquer le manifeste de cette release après avoir vérifié sa compatibilité avec le schéma de la base. La CI réutilise le manifeste du dépôt avec `node scripts/render-openshift.mjs IMAGE@sha256:DIGEST` pour y inscrire le digest de chaque nouvelle version.
